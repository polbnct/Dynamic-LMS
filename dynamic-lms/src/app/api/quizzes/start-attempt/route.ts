import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { quizId } = await request.json();
    if (!quizId) return NextResponse.json({ error: "quizId is required" }, { status: 400 });

    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!student?.id) return NextResponse.json({ error: "Student not found" }, { status: 403 });

    // Reuse in-progress attempt if present
    const { data: existingAttempt } = await admin
      .from("quiz_attempts")
      .select("*")
      .eq("quiz_id", quizId)
      .eq("student_id", student.id)
      .is("submitted_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingAttempt) {
      return NextResponse.json({ attempt: existingAttempt }, { status: 200 });
    }

    // Load quiz config (max attempts and lock time)
    const { data: quiz, error: quizErr } = await admin
      .from("quizzes")
      .select("id, max_attempts, due_date, points_per_question")
      .eq("id", quizId)
      .single();
    if (quizErr || !quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

    // Enforce lock time: after due_date, no new attempts may be started
    if (quiz.due_date) {
      const lockTime = new Date(quiz.due_date).getTime();
      if (!Number.isNaN(lockTime) && lockTime <= Date.now()) {
        return NextResponse.json(
          { error: "This quiz is locked and can no longer be taken." },
          { status: 403 }
        );
      }
    }

    // Count submitted attempts
    const { count: submittedCount, error: countErr } = await admin
      .from("quiz_attempts")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", quizId)
      .eq("student_id", student.id)
      .not("submitted_at", "is", null);
    if (countErr) return NextResponse.json({ error: "Failed to check attempts" }, { status: 500 });

    // Extra attempts (retakes)
    let extra = 0;
    try {
      const { data: retakeRow } = await admin
        .from("quiz_retakes")
        .select("extra_attempts")
        .eq("quiz_id", quizId)
        .eq("student_id", student.id)
        .maybeSingle();
      extra = retakeRow?.extra_attempts ? Number(retakeRow.extra_attempts) : 0;
    } catch {
      extra = 0;
    }

    const baseMax = quiz.max_attempts == null ? null : Number(quiz.max_attempts);
    const allowed = baseMax == null ? null : baseMax + extra;
    if (allowed != null && (submittedCount || 0) >= allowed) {
      return NextResponse.json({ error: "No remaining attempts for this quiz." }, { status: 403 });
    }

    // Max score based on number of questions and configured points per question
    const { count: questionCount } = await admin
      .from("quiz_questions")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", quizId);

    const pointsPerQuestion =
      quiz.points_per_question != null ? Number(quiz.points_per_question) : 10;
    const finalPointsPerQuestion = Number.isFinite(pointsPerQuestion) && pointsPerQuestion > 0 ? pointsPerQuestion : 10;

    const { data: attempt, error: insertErr } = await admin
      .from("quiz_attempts")
      .insert({
        quiz_id: quizId,
        student_id: student.id,
        started_at: new Date().toISOString(),
        max_score: (questionCount || 0) * finalPointsPerQuestion,
      })
      .select()
      .single();

    if (insertErr || !attempt) {
      // Handle unique constraint on in-progress attempts (partial index)
      const code = (insertErr as any)?.code;
      if (code === "23505") {
        // Another request created the in-progress attempt; fetch and reuse it
        const { data: concurrentAttempt } = await admin
          .from("quiz_attempts")
          .select("*")
          .eq("quiz_id", quizId)
          .eq("student_id", student.id)
          .is("submitted_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (concurrentAttempt) {
          return NextResponse.json({ attempt: concurrentAttempt }, { status: 200 });
        }
      }

      return NextResponse.json({ error: "Failed to start attempt" }, { status: 500 });
    }

    return NextResponse.json({ attempt }, { status: 200 });
  } catch (error: any) {
    console.error("start-attempt error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

