import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { courseId } = await params;
    if (!courseId) return jsonError("courseId is required", 400);

    const body = await request.json().catch(() => ({}));
    const studentDbId = String(body?.studentDbId ?? body?.student_id ?? "").trim();
    if (!studentDbId) return jsonError("studentDbId is required", 400);

    const { data: enrollment, error } = await admin
      .from("enrollments")
      .insert({
        course_id: courseId,
        student_id: studentDbId,
      })
      .select("id, course_id, student_id, enrolled_at")
      .single();

    if (error) {
      const code = (error as any)?.code;
      if (code === "23505") {
        return jsonError("Student is already enrolled in this course.", 409);
      }
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

