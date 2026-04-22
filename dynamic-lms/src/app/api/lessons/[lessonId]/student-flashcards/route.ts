import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FLASHCARD_WORDS = 30;

function buildStudentFlashcardSignature(question: string, answer: string): string {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  return `${normalize(question)}::${normalize(answer)}`;
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

async function getStudentContextForLesson(lessonId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentErr || !student) {
    return {
      supabase,
      error: NextResponse.json({ error: "Student not found" }, { status: 403 }),
    };
  }

  const { data: lesson, error: lessonErr } = await supabase
    .from("lessons")
    .select("id, course_id")
    .eq("id", lessonId)
    .single();

  if (lessonErr || !lesson) {
    return {
      supabase,
      error: NextResponse.json({ error: "Lesson not found" }, { status: 404 }),
    };
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", lesson.course_id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (!enrollment) {
    return {
      supabase,
      error: NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 }),
    };
  }

  return { supabase, studentId: student.id, lessonId: lesson.id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID required" }, { status: 400 });
    }

    const context = await getStudentContextForLesson(lessonId);
    if ("error" in context) return context.error;

    const { supabase, studentId } = context;
    const { data, error } = await supabase
      .from("student_lesson_flashcards")
      .select("id, lesson_id, question, answer, created_at, updated_at")
      .eq("lesson_id", lessonId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Student flashcards GET error:", error);
      return NextResponse.json({ error: "Failed to load student flashcards" }, { status: 500 });
    }

    return NextResponse.json({ flashcards: data ?? [] });
  } catch (error) {
    console.error("Student flashcards GET exception:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
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
    const question = String(body?.question ?? "").trim();
    const answer = String(body?.answer ?? "").trim();

    if (!question || !answer) {
      return NextResponse.json({ error: "Question and answer are required" }, { status: 400 });
    }

    if (countWords(question) > MAX_FLASHCARD_WORDS || countWords(answer) > MAX_FLASHCARD_WORDS) {
      return NextResponse.json(
        { error: `Question and answer must be ${MAX_FLASHCARD_WORDS} words or fewer` },
        { status: 400 }
      );
    }

    if (question.length > 500 || answer.length > 500) {
      return NextResponse.json(
        { error: "Question and answer must be 500 characters or fewer" },
        { status: 400 }
      );
    }

    const context = await getStudentContextForLesson(lessonId);
    if ("error" in context) return context.error;

    const { supabase, studentId } = context;
    const questionSignature = buildStudentFlashcardSignature(question, answer);

    const { data, error } = await supabase
      .from("student_lesson_flashcards")
      .insert({
        lesson_id: lessonId,
        student_id: studentId,
        question,
        answer,
        question_signature: questionSignature,
      })
      .select("id, lesson_id, question, answer, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This flashcard already exists in your lesson set" },
          { status: 409 }
        );
      }
      console.error("Student flashcards POST error:", error);
      return NextResponse.json({ error: "Failed to create flashcard" }, { status: 500 });
    }

    return NextResponse.json({ flashcard: data }, { status: 201 });
  } catch (error) {
    console.error("Student flashcards POST exception:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
