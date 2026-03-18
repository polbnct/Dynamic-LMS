import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { userId } = await params;
    if (!userId) return jsonError("userId is required", 400);

    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password || password.trim().length < 8) {
      return jsonError("Password must be at least 8 characters long.", 400);
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(userId, { password } as any);
    if (authErr) return jsonError(authErr.message, 500);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

