import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase().replace(/\s+/g, "");
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
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const email = emailRaw ? normalizeEmail(emailRaw) : "";

    if (!name) return jsonError("Name is required.", 400);
    if (!email) return jsonError("Email is required.", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("Please enter a valid email address.", 400);
    }

    // Update Auth (email + metadata) without confirmation flow.
    const { error: authErr } = await admin.auth.admin.updateUserById(
      userId,
      {
        email,
        email_confirm: true,
        user_metadata: { name },
      } as any
    );
    if (authErr) return jsonError(authErr.message, 500);

    // Keep public.users in sync.
    const { error: dbErr } = await admin.from("users").update({ name, email }).eq("id", userId);
    if (dbErr) return jsonError(dbErr.message, 500);

    return NextResponse.json({ ok: true, user: { id: userId, name, email } }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

