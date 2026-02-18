import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID required" }, { status: 400 });
    }

    const body = await request.json();
    const { questionType, score, maxScore } = body as {
      questionType: "multiple_choice" | "fill_blank";
      score: number;
      maxScore: number;
    };

    if (
      !questionType ||
      !["multiple_choice", "fill_blank"].includes(questionType) ||
      typeof score !== "number" ||
      typeof maxScore !== "number" ||
      score < 0 ||
      maxScore <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid questionType, score, or maxScore" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, course_id")
      .eq("id", lessonId)
      .single();

    if (lessonErr || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { data: student, error: studentErr } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (studentErr || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 403 });
    }

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", lesson.course_id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
    }

    const { data: attempt, error: insertErr } = await supabase
      .from("study_aid_attempts")
      .insert({
        lesson_id: lessonId,
        student_id: student.id,
        question_type: questionType,
        score: Math.min(score, maxScore),
        max_score: maxScore,
      })
      .select("id, score, max_score, created_at")
      .single();

    if (insertErr) {
      console.error("Study aid attempt insert error:", insertErr);
      const message = insertErr.message || "Failed to save attempt";
      return NextResponse.json(
        { error: message, code: insertErr.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, attempt });
  } catch (e: unknown) {
    console.error("Study aid attempts POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
