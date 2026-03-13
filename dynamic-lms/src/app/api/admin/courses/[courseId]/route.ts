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
      .select("id, name, code, classroom_code, professor_id, created_at")
      .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ course: data }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

