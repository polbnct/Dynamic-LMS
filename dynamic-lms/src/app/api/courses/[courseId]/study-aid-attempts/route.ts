import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface StudyAidAttemptRow {
  lesson_id: string;
  question_type: string;
  score: number;
  max_score: number;
  created_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    if (!courseId) {
      return NextResponse.json({ error: "Course ID required" }, { status: 400 });
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

    const { data: lessonIds, error: lessonsErr } = await supabase
      .from("lessons")
      .select("id")
      .eq("course_id", courseId)
      .order("order", { ascending: true });

    if (lessonsErr || !lessonIds?.length) {
      return NextResponse.json({ attempts: [] });
    }

    const ids = lessonIds.map((l: { id: string }) => l.id);
    const { data: attempts, error: attemptsErr } = await supabase
      .from("study_aid_attempts")
      .select("lesson_id, question_type, score, max_score, created_at")
      .eq("student_id", student.id)
      .in("lesson_id", ids)
      .order("created_at", { ascending: false });

    if (attemptsErr) {
      console.error("Study aid attempts fetch error:", attemptsErr);
      return NextResponse.json({ attempts: [] });
    }

    return NextResponse.json({ attempts: attempts ?? [] });
  } catch (e: unknown) {
    console.error("Study aid attempts GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
