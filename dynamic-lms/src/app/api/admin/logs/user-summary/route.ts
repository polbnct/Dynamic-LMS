import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { LogUserSummary } from "@/types/errorLog";
import { isMissingLogTableError, LEGACY_LOG_TABLE, LOG_TABLE } from "@/lib/logs/logTable";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const userId = new URL(request.url).searchParams.get("userId")?.trim();
    if (!userId) {
      return jsonError("userId is required", 400);
    }

    const admin = createAdminClient();

    const { data: user, error: userErr } = await admin
      .from("users")
      .select("id, name, email, role")
      .eq("id", userId)
      .maybeSingle();

    if (userErr) {
      return jsonError(userErr.message, 500);
    }
    if (!user) {
      return jsonError("User not found", 404);
    }

    const u = user as { id: string; name: string; email: string; role: string | null };

    let table: string = LOG_TABLE;
    const runCounts = async (t: string) => {
      const [totalRes, errRes, actRes, lastRes] = await Promise.all([
        admin.from(t).select("id", { count: "exact", head: true }).eq("user_id", userId),
        admin.from(t).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("category", "error"),
        admin.from(t).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("category", "action"),
        admin.from(t).select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return { totalRes, errRes, actRes, lastRes };
    };

    let { totalRes, errRes, actRes, lastRes } = await runCounts(table);
    if (totalRes.error && isMissingLogTableError(totalRes.error)) {
      table = LEGACY_LOG_TABLE;
      ({ totalRes, errRes, actRes, lastRes } = await runCounts(table));
    }

    if (totalRes.error) {
      return jsonError(totalRes.error.message, 500);
    }

    const lastAt = (lastRes.data as { created_at?: string } | null)?.created_at ?? null;

    const summary: LogUserSummary = {
      userId: u.id,
      name: u.name ?? "",
      email: u.email ?? "",
      role: u.role ?? null,
      totalLogCount: totalRes.count ?? 0,
      errorCount: errRes.count ?? 0,
      actionCount: actRes.count ?? 0,
      lastActivityAt: lastAt,
    };

    return NextResponse.json({ summary, logTable: table });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status =
      msg === "Not authenticated" ? 401 : msg === "Not authorized" ? 403 : msg.startsWith("Not ") ? 403 : 500;
    return jsonError(msg, status);
  }
}
