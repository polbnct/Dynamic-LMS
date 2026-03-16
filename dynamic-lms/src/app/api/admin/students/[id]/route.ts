import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { id } = await params;
    if (!id) return jsonError("id is required", 400);

    const { data: student, error: studErr } = await admin
      .from("students")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();
    if (studErr) return jsonError(studErr.message, 500);
    if (!student?.user_id) return jsonError("Student not found", 404);

    const userId = (student as any).user_id as string;

    // Delete auth user; ON DELETE CASCADE will clean up public.users, students, enrollments, etc.
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) return jsonError(authErr.message, 500);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

