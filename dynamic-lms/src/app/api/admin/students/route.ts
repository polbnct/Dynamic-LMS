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

    const { data: students, error } = await admin
      .from("students")
      .select("id, user_id, student_id")
      .order("id", { ascending: true });
    if (error) return jsonError(error.message, 500);

    const userIds = (students ?? []).map((s: any) => s.user_id).filter(Boolean) as string[];
    let usersById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users, error: userErr } = await admin
        .from("users")
        .select("id, name, email, role")
        .in("id", userIds);
      if (userErr) return jsonError(userErr.message, 500);
      usersById = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));
    }

    // Exclude admin accounts that may still have a students row.
    const result = (students ?? [])
      .filter((s: any) => usersById[s.user_id]?.role !== "admin")
      .map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        student_id: s.student_id,
        name: usersById[s.user_id]?.name || "Unknown",
        email: usersById[s.user_id]?.email || "",
      }));

    return NextResponse.json({ students: result }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

