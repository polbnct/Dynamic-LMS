import { NextResponse } from "next/server";
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
      .select("id, user_id, department")
      .order("id", { ascending: true });
    if (error) return jsonError(error.message, 500);

    const userIds = (professors ?? []).map((p: any) => p.user_id).filter(Boolean) as string[];
    let usersById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users, error: userErr } = await admin
        .from("users")
        .select("id, name, email")
        .in("id", userIds);
      if (userErr) return jsonError(userErr.message, 500);
      usersById = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));
    }

    const result = (professors ?? []).map((p: any) => ({
      id: p.id,
      department: p.department,
      user_id: p.user_id,
      name: usersById[p.user_id]?.name || "Unknown",
      email: usersById[p.user_id]?.email || "",
    }));

    return NextResponse.json({ professors: result }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

