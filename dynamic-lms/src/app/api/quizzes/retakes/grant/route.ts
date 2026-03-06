import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { quizId, studentId, incrementBy } = await request.json();
    if (!quizId || !studentId) {
      return NextResponse.json({ error: "quizId and studentId are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: prof } = await supabase
      .from("professors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!prof?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Verify professor owns the quiz's course
    const { data: quiz } = await admin.from("quizzes").select("id, course_id").eq("id", quizId).single();
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

    const { data: course } = await admin.from("courses").select("id, professor_id").eq("id", quiz.course_id).single();
    if (!course || course.professor_id !== prof.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const inc = typeof incrementBy === "number" && incrementBy > 0 ? Math.floor(incrementBy) : 1;

    const { data: existing } = await admin
      .from("quiz_retakes")
      .select("extra_attempts")
      .eq("quiz_id", quizId)
      .eq("student_id", studentId)
      .maybeSingle();

    const nextExtra = (existing?.extra_attempts ? Number(existing.extra_attempts) : 0) + inc;

    const { error } = await admin.from("quiz_retakes").upsert(
      {
        quiz_id: quizId,
        student_id: studentId,
        extra_attempts: nextExtra,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "quiz_id,student_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ extra_attempts: nextExtra }, { status: 200 });
  } catch (error: any) {
    console.error("grant retake error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

