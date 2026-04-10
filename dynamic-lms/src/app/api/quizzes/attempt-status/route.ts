import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { courseId } = await request.json();
    if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

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

    // Quizzes in this course
    const { data: quizzes, error: quizErr } = await admin
      .from("quizzes")
      .select("id, max_attempts, due_date")
      .eq("course_id", courseId);
    if (quizErr || !quizzes?.length) return NextResponse.json({ statuses: [] }, { status: 200 });

    const quizIds = quizzes.map((q) => q.id);

    // In-progress attempts (submitted_at is null) — at most one per quiz per student in practice
    const { data: inProgressRows } = await admin
      .from("quiz_attempts")
      .select("id, quiz_id")
      .in("quiz_id", quizIds)
      .eq("student_id", student.id)
      .is("submitted_at", null);

    const inProgressByQuiz: Record<string, string> = {};
    (inProgressRows || []).forEach((row: { id: string; quiz_id: string }) => {
      if (row?.quiz_id && row?.id) {
        inProgressByQuiz[row.quiz_id] = row.id;
      }
    });

    // Submitted attempts per quiz
    const { data: attempts } = await admin
      .from("quiz_attempts")
      .select("quiz_id, submitted_at")
      .in("quiz_id", quizIds)
      .eq("student_id", student.id)
      .not("submitted_at", "is", null);

    const usedMap: Record<string, number> = {};
    (attempts || []).forEach((a: any) => {
      usedMap[a.quiz_id] = (usedMap[a.quiz_id] || 0) + 1;
    });

    // Retakes for this student
    const { data: retakes } = await admin
      .from("quiz_retakes")
      .select("quiz_id, extra_attempts")
      .in("quiz_id", quizIds)
      .eq("student_id", student.id);
    const extraMap: Record<string, number> = {};
    (retakes || []).forEach((r: any) => {
      extraMap[r.quiz_id] = r.extra_attempts != null ? Number(r.extra_attempts) : 0;
    });

    const now = new Date();

    const statuses = quizzes.map((q: any) => {
      const used = usedMap[q.id] || 0;
      const extra = extraMap[q.id] || 0;
      const baseMax = q.max_attempts == null ? null : Number(q.max_attempts);
      const allowed = baseMax == null ? null : baseMax + extra;
      const remaining = allowed == null ? null : Math.max(allowed - used, 0);
      const isLocked = q.due_date ? new Date(q.due_date as string).getTime() <= now.getTime() : false;
      return {
        quizId: q.id,
        attemptsUsed: used,
        extraAttempts: extra,
        maxAttempts: baseMax,
        allowedAttempts: allowed,
        remainingAttempts: remaining,
        isLocked,
        inProgressAttemptId: inProgressByQuiz[q.id] ?? null,
      };
    });

    return NextResponse.json({ statuses }, { status: 200 });
  } catch (error: any) {
    console.error("attempt-status error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

