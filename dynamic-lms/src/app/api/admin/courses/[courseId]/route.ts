import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { courseId } = await params;
    if (!courseId) return jsonError("courseId is required", 400);

    const body = await request.json();
    const payload: Record<string, any> = {};
    if (body?.name !== undefined) payload.name = String(body.name).trim();
    if (body?.code !== undefined) payload.code = String(body.code).trim();
    if (body?.professor_id !== undefined) {
      payload.professor_id = body.professor_id ? String(body.professor_id) : null;
    }

    if (payload.name !== undefined && !payload.name) return jsonError("name cannot be empty", 400);
    if (payload.code !== undefined && !payload.code) return jsonError("code cannot be empty", 400);

    const { data, error } = await admin
      .from("courses")
      .update(payload)
      .eq("id", courseId)
      .select("id, name, code, professor_id, created_at")
      .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ course: data }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { courseId } = await params;
    if (!courseId) return jsonError("courseId is required", 400);

    // Delete enrollments
    const { error: enrollError } = await admin
      .from("enrollments")
      .delete()
      .eq("course_id", courseId);
    if (enrollError) return jsonError(enrollError.message, 500);

    // Delete assignments and submissions
    const { data: assignments, error: assignmentsError } = await admin
      .from("assignments")
      .select("id")
      .eq("course_id", courseId);
    if (assignmentsError) return jsonError(assignmentsError.message, 500);

    const assignmentIds = (assignments ?? []).map((a: any) => a.id);
    if (assignmentIds.length > 0) {
      const { error: subError } = await admin
        .from("assignment_submissions")
        .delete()
        .in("assignment_id", assignmentIds);
      if (subError) return jsonError(subError.message, 500);

      const { error: assnDelError } = await admin
        .from("assignments")
        .delete()
        .in("id", assignmentIds);
      if (assnDelError) return jsonError(assnDelError.message, 500);
    }

    // Delete quizzes and related data via helper tables
    const { data: quizzes, error: quizzesError } = await admin
      .from("quizzes")
      .select("id")
      .eq("course_id", courseId);
    if (quizzesError) return jsonError(quizzesError.message, 500);

    const quizIds = (quizzes ?? []).map((q: any) => q.id);
    if (quizIds.length > 0) {
      // Delete answers that belong to attempts for these quizzes
      const { data: attempts, error: attemptsFetchError } = await admin
        .from("quiz_attempts")
        .select("id")
        .in("quiz_id", quizIds);
      if (attemptsFetchError) return jsonError(attemptsFetchError.message, 500);

      const attemptIds = (attempts ?? []).map((a: any) => a.id);
      if (attemptIds.length > 0) {
        const { error: quizAnswersError } = await admin
          .from("quiz_answers")
          .delete()
          .in("attempt_id", attemptIds);
        if (quizAnswersError) return jsonError(quizAnswersError.message, 500);
      }

      const { error: quizAttemptsError } = await admin
        .from("quiz_attempts")
        .delete()
        .in("quiz_id", quizIds);
      if (quizAttemptsError) return jsonError(quizAttemptsError.message, 500);

      const { error: quizQuestionsError } = await admin
        .from("quiz_questions")
        .delete()
        .in("quiz_id", quizIds);
      if (quizQuestionsError) return jsonError(quizQuestionsError.message, 500);

      const { error: quizzesDelError } = await admin
        .from("quizzes")
        .delete()
        .in("id", quizIds);
      if (quizzesDelError) return jsonError(quizzesDelError.message, 500);
    }

    // Delete lessons
    const { error: lessonsError } = await admin
      .from("lessons")
      .delete()
      .eq("course_id", courseId);
    if (lessonsError) return jsonError(lessonsError.message, 500);

    // Finally delete course row
    const { error: courseError } = await admin
      .from("courses")
      .delete()
      .eq("id", courseId);
    if (courseError) return jsonError(courseError.message, 500);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

