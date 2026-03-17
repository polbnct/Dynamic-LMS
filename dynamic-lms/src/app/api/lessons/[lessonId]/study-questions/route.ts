import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: links, error: linkError } = await supabase
      .from("lesson_study_questions")
      .select("question_id, order")
      .eq("lesson_id", lessonId)
      .order("order", { ascending: true });

    if (linkError) {
      console.error("Error fetching lesson study questions:", linkError);
      return NextResponse.json(
        { error: "Failed to load study questions" },
        { status: 500 }
      );
    }

    if (!links || links.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    const questionIds = links.map((l: { question_id: string }) => l.question_id);
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id, type, question, options, correct_answer")
      .in("id", questionIds);

    if (qError || !questions) {
      return NextResponse.json({ questions: [] });
    }

    const orderMap = new Map(links.map((l: any) => [l.question_id, l.order ?? 0]));
    const sorted = [...questions].sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
    );

    const formatted = sorted.map((q: any) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: typeof q.options === "string" ? JSON.parse(q.options || "[]") : q.options || [],
      correct_answer:
        typeof q.correct_answer === "string"
          ? JSON.parse(q.correct_answer)
          : q.correct_answer,
    }));

    return NextResponse.json({ questions: formatted });
  } catch (e: any) {
    console.error("Study questions GET error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

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
    const { questions: questionsToAdd } = body as {
      questions: Array<{
        type: "multiple_choice" | "true_false" | "fill_blank" | "summary";
        question: string;
        options?: string[];
        correct_answer: number | boolean | string;
      }>;
    };

    if (!Array.isArray(questionsToAdd) || questionsToAdd.length === 0) {
      return NextResponse.json(
        { error: "questions array required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, course_id")
      .eq("id", lessonId)
      .single();

    if (lessonErr || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { data: course } = await supabase
      .from("courses")
      .select("professor_id")
      .eq("id", lesson.course_id)
      .single();

    if (!course?.professor_id) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: prof } = await supabase
      .from("professors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!prof || prof.id !== course.professor_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const professorId = course.professor_id;
    const courseId = lesson.course_id;
    const createdIds: string[] = [];
    let firstError: string | null = null;

    for (let i = 0; i < questionsToAdd.length; i++) {
      const q = questionsToAdd[i];
      const optionsJson =
        q.type === "multiple_choice" && Array.isArray(q.options)
          ? JSON.stringify(q.options)
          : null;
      const correctAnswerJson =
        q.correct_answer !== undefined && q.correct_answer !== null
          ? JSON.stringify(q.correct_answer)
          : null;

      const { data: newQuestion, error: insertErr } = await supabase
        .from("questions")
        .insert({
          course_id: courseId,
          professor_id: professorId,
          type: q.type,
          question: String(q.question || "").trim() || "Question",
          options: optionsJson,
          correct_answer: correctAnswerJson ?? JSON.stringify(""),
          source_lesson_id: lessonId,
          source_type: "lesson",
        })
        .select("id")
        .single();

      if (insertErr || !newQuestion) {
        const errMsg = insertErr?.message || "Insert failed";
        console.error("Error inserting study question:", insertErr);
        if (!firstError) firstError = errMsg;
        continue;
      }

      createdIds.push(newQuestion.id);

      const { error: linkErr } = await supabase.from("lesson_study_questions").insert({
        lesson_id: lessonId,
        question_id: newQuestion.id,
        order: i + 1,
      });

      if (linkErr) {
        console.error("Error linking study question to lesson:", linkErr);
        await supabase.from("questions").delete().eq("id", newQuestion.id);
        if (!firstError) firstError = linkErr.message;
        continue;
      }
    }

    if (createdIds.length === 0 && firstError) {
      return NextResponse.json(
        { error: firstError || "Failed to save any questions" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      added: createdIds.length,
      questionIds: createdIds,
    });
  } catch (e: any) {
    console.error("Study questions POST error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}
