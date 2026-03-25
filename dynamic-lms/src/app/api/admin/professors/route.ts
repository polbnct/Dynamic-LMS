import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { data: professors, error } = await admin
      .from("professors")
      .select("id, user_id")
      .order("id", { ascending: true });
    if (error) return jsonError(error.message, 500);

    const userIds = (professors ?? []).map((p: any) => p.user_id).filter(Boolean) as string[];
    let usersById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users, error: userErr } = await admin
        .from("users")
        .select("id, name, email, role")
        .in("id", userIds);
      if (userErr) return jsonError(userErr.message, 500);
      usersById = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));
    }

    // Exclude admin accounts that may still have a professors row.
    const result = (professors ?? [])
      .filter((p: any) => usersById[p.user_id]?.role !== "admin")
      .map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        name: usersById[p.user_id]?.name || "Unknown",
        email: usersById[p.user_id]?.email || "",
      }));

    return NextResponse.json({ professors: result }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const email = emailRaw ? emailRaw.trim().toLowerCase().replace(/\s+/g, "") : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name) return jsonError("Name is required.", 400);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Please enter a valid email address.", 400);
    if (!password || password.trim().length < 8) return jsonError("Password must be at least 8 characters long.", 400);

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: "professor",
      },
    } as any);

    if (authErr || !authData?.user) {
      return jsonError((authErr as any)?.message || "Failed to create professor auth user.", 500);
    }

    const userId = authData.user.id as string;

    // Create public.users row.
    const { error: userErr } = await admin
      .from("users")
      .insert({
        id: userId,
        email,
        name,
        role: "professor",
      });
    if (userErr) {
      // If user insert fails, roll back auth user for consistency.
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return jsonError(userErr.message, 500);
    }

    // Create professors row.
    const { error: profErr } = await admin.from("professors").insert({ user_id: userId });
    if (profErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return jsonError(profErr.message, 500);
    }

    return NextResponse.json({ ok: true, professor: { user_id: userId, name, email } }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

