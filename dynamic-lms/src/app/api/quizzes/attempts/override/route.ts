import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  try {
    const { attemptId, quizId, courseId, questionId, isCorrect } = await request.json();
    if (!attemptId || !quizId || !courseId || !questionId || typeof isCorrect !== "boolean") {
      return NextResponse.json(
        { error: "attemptId, quizId, courseId, questionId, and boolean isCorrect are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: professor } = await supabase
      .from("professors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!professor?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("id, quiz_id, max_score")
      .eq("id", attemptId)
      .maybeSingle();
    if (!attempt?.id) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.quiz_id !== quizId) {
      return NextResponse.json({ error: "Attempt does not belong to this quiz" }, { status: 400 });
    }

    const { data: quiz } = await admin
      .from("quizzes")
      .select("id, course_id")
      .eq("id", quizId)
      .maybeSingle();
    if (!quiz?.id) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    if (quiz.course_id !== courseId) {
      return NextResponse.json({ error: "Quiz does not belong to this course" }, { status: 400 });
    }

    const { data: course } = await admin
      .from("courses")
      .select("id, professor_id")
      .eq("id", courseId)
      .maybeSingle();
    if (!course?.id || course.professor_id !== professor.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: existingAnswer } = await admin
      .from("quiz_answers")
      .select("id")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .maybeSingle();
    if (!existingAnswer?.id) {
      return NextResponse.json({ error: "Answer row not found for attempt/question" }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from("quiz_answers")
      .update({ is_correct: isCorrect })
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: answerRows, error: answerRowsError } = await admin
      .from("quiz_answers")
      .select("is_correct")
      .eq("attempt_id", attemptId);
    if (answerRowsError) {
      return NextResponse.json({ error: answerRowsError.message }, { status: 500 });
    }

    const totalAnswered = answerRows?.length ?? 0;
    const correctCount = (answerRows || []).filter((row: any) => Boolean(row.is_correct)).length;
    const maxScore = Number(attempt.max_score ?? 0);
    const nextScore =
      totalAnswered > 0 && maxScore > 0 ? Math.round((correctCount / totalAnswered) * maxScore) : 0;

    const { error: scoreUpdateError } = await admin
      .from("quiz_attempts")
      .update({ score: nextScore })
      .eq("id", attemptId);
    if (scoreUpdateError) {
      return NextResponse.json({ error: scoreUpdateError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        attemptId,
        questionId,
        isCorrect,
        score: nextScore,
        maxScore,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("attempt override error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
