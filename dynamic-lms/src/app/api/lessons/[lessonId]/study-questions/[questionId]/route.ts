import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function ensureProfessorCanEditLesson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string
) {
  const { data: lesson, error: lessonErr } = await supabase
    .from("lessons")
    .select("id, course_id")
    .eq("id", lessonId)
    .single();

  if (lessonErr || !lesson) {
    return { error: NextResponse.json({ error: "Lesson not found" }, { status: 404 }) };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("professor_id")
    .eq("id", lesson.course_id)
    .single();

  if (!course?.professor_id) {
    return { error: NextResponse.json({ error: "Course not found" }, { status: 404 }) };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: prof } = await supabase
    .from("professors")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!prof || prof.id !== course.professor_id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { lesson, course };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string; questionId: string }> }
) {
  try {
    const { lessonId, questionId } = await params;
    if (!lessonId || !questionId) {
      return NextResponse.json(
        { error: "Lesson ID and Question ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      type,
      question: questionText,
      options,
      correct_answer: correctAnswer,
    } = body as {
      type?: "multiple_choice" | "true_false" | "fill_blank" | "summary";
      question?: string;
      options?: string[];
      correct_answer?:
        | number
        | boolean
        | string
        | {
            answer: number | boolean | string;
            correct_explanation?: string;
            incorrect_explanation?: string;
          };
    };

    const supabase = await createClient();
    const auth = await ensureProfessorCanEditLesson(supabase, lessonId);
    if ("error" in auth) return auth.error;

    const { data: link } = await supabase
      .from("lesson_study_questions")
      .select("question_id")
      .eq("lesson_id", lessonId)
      .eq("question_id", questionId)
      .maybeSingle();

    if (!link) {
      return NextResponse.json(
        { error: "Question is not part of this lesson's study aid" },
        { status: 404 }
      );
    }

    if (type === "summary") {
      const { data: summaryConflict } = await supabase
        .from("lesson_study_questions")
        .select("question_id, questions!inner(type)")
        .eq("lesson_id", lessonId)
        .eq("questions.type", "summary")
        .neq("question_id", questionId)
        .limit(1);

      if (summaryConflict && summaryConflict.length > 0) {
        return NextResponse.json(
          { error: "A summary already exists for this lesson. Remove it first before converting another item to summary." },
          { status: 409 }
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (type !== undefined) updates.type = type;
    if (questionText !== undefined) updates.question = questionText.trim();
    if (options !== undefined) {
      updates.options = Array.isArray(options) ? JSON.stringify(options) : null;
    }
    if (correctAnswer !== undefined && correctAnswer !== null) {
      updates.correct_answer = JSON.stringify(correctAnswer);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("questions")
      .update(updates)
      .eq("id", questionId)
      .select("id, type, question, options, correct_answer")
      .single();

    if (updateErr) {
      console.error("Study question PATCH error:", updateErr);
      return NextResponse.json(
        { error: updateErr.message || "Update failed" },
        { status: 400 }
      );
    }

    const formatted = {
      id: updated.id,
      type: updated.type,
      question: updated.question,
      options:
        typeof updated.options === "string"
          ? JSON.parse(updated.options || "[]")
          : updated.options || [],
      correct_answer:
        typeof updated.correct_answer === "string"
          ? JSON.parse(updated.correct_answer)
          : updated.correct_answer,
    };

    return NextResponse.json({ question: formatted });
  } catch (e: any) {
    console.error("Study question PATCH error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string; questionId: string }> }
) {
  try {
    const { lessonId, questionId } = await params;
    if (!lessonId || !questionId) {
      return NextResponse.json(
        { error: "Lesson ID and Question ID required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const auth = await ensureProfessorCanEditLesson(supabase, lessonId);
    if ("error" in auth) return auth.error;

    await supabase
      .from("lesson_study_questions")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("question_id", questionId);

    await supabase.from("questions").delete().eq("id", questionId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Study question DELETE error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}
