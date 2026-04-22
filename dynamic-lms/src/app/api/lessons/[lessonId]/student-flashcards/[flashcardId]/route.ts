import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FLASHCARD_WORDS = 30;

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; flashcardId: string }> }
) {
  try {
    const { lessonId, flashcardId } = await params;
    if (!lessonId || !flashcardId) {
      return NextResponse.json(
        { error: "Lesson ID and Flashcard ID are required" },
        { status: 400 }
      );
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: student, error: studentErr } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (studentErr || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 403 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("student_lesson_flashcards")
      .update({ question, answer, updated_at: new Date().toISOString() })
      .eq("id", flashcardId)
      .eq("lesson_id", lessonId)
      .eq("student_id", student.id)
      .select("id, lesson_id, question, answer, created_at, updated_at")
      .maybeSingle();

    if (updateErr) {
      console.error("Student flashcards PATCH error:", updateErr);
      return NextResponse.json({ error: "Failed to update flashcard" }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "Flashcard not found" }, { status: 404 });
    }

    return NextResponse.json({ flashcard: updated });
  } catch (error) {
    console.error("Student flashcards PATCH exception:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; flashcardId: string }> }
) {
  try {
    const { lessonId, flashcardId } = await params;
    if (!lessonId || !flashcardId) {
      return NextResponse.json(
        { error: "Lesson ID and Flashcard ID are required" },
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

    const { data: student, error: studentErr } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (studentErr || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 403 });
    }

    const { data: deleted, error: deleteErr } = await supabase
      .from("student_lesson_flashcards")
      .delete()
      .eq("id", flashcardId)
      .eq("lesson_id", lessonId)
      .eq("student_id", student.id)
      .select("id")
      .maybeSingle();

    if (deleteErr) {
      console.error("Student flashcards DELETE error:", deleteErr);
      return NextResponse.json({ error: "Failed to delete flashcard" }, { status: 500 });
    }

    if (!deleted) {
      return NextResponse.json({ error: "Flashcard not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Student flashcards DELETE exception:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
