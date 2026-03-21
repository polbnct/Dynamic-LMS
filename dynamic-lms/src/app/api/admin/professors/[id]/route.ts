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

    const { data: professor, error: profErr } = await admin
      .from("professors")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();
    if (profErr) return jsonError(profErr.message, 500);
    if (!professor?.user_id) return jsonError("Professor not found", 404);

    const userId = (professor as any).user_id as string;

    // Delete auth user; ON DELETE CASCADE will clean up public.users, professors, students, etc.
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) return jsonError(authErr.message, 500);

    // Verify deletion so we don't report success when auth user still exists.
    const { data: verifyUser, error: verifyErr } = await admin.auth.admin.getUserById(userId);
    if (!verifyErr && verifyUser) {
      return jsonError("Auth user deletion did not complete (user still exists).", 500);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

