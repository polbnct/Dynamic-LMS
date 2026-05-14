import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { LogUserDirectoryEntry } from "@/types/errorLog";
import { isMissingLogTableError, LEGACY_LOG_TABLE, LOG_TABLE } from "@/lib/logs/logTable";

export const dynamic = "force-dynamic";

const SCAN_LIMIT = 12_000;
const COUNT_CHUNK = 25;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function scanRecent(admin: ReturnType<typeof createAdminClient>, table: string) {
  return admin
    .from(table)
    .select("user_id, created_at")
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(SCAN_LIMIT);
}

async function countByUser(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  userIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < userIds.length; i += COUNT_CHUNK) {
    const slice = userIds.slice(i, i + COUNT_CHUNK);
    await Promise.all(
      slice.map(async (userId) => {
        const { count, error } = await admin
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        out.set(userId, error ? 0 : count ?? 0);
      })
    );
  }
  return out;
}

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    let table: string = LOG_TABLE;
    let { data: rows, error } = await scanRecent(admin, table);
    if (error && isMissingLogTableError(error)) {
      table = LEGACY_LOG_TABLE;
      ({ data: rows, error } = await scanRecent(admin, table));
    }
    if (error) {
      return jsonError(error.message, 500);
    }

    const stats = new Map<string, { lastAt: string; sampleCount: number }>();
    for (const row of rows ?? []) {
      const uid = (row as { user_id: string | null }).user_id;
      if (!uid) continue;
      const st = stats.get(uid);
      if (!st) {
        stats.set(uid, { lastAt: (row as { created_at: string }).created_at, sampleCount: 1 });
      } else {
        st.sampleCount += 1;
      }
    }

    const sortedIds = [...stats.entries()]
      .sort((a, b) => (a[1].lastAt < b[1].lastAt ? 1 : -1))
      .map(([id]) => id);

    if (sortedIds.length === 0) {
      return NextResponse.json({ users: [] as LogUserDirectoryEntry[], scannedTable: table, scanRowCap: SCAN_LIMIT });
    }

    const { data: userRows, error: uErr } = await admin.from("users").select("id, name, email, role").in("id", sortedIds);
    if (uErr) {
      return jsonError(uErr.message, 500);
    }

    const profileById = new Map(
      (userRows ?? []).map((u) => {
        const row = u as { id: string; name: string; email: string; role: string | null };
        return [row.id, row] as const;
      })
    );

    const totals = await countByUser(admin, table, sortedIds);

    const users: LogUserDirectoryEntry[] = sortedIds.map((userId) => {
      const st = stats.get(userId)!;
      const prof = profileById.get(userId);
      return {
        userId,
        name: prof?.name?.trim() || "Unknown user",
        email: prof?.email?.trim() || "—",
        role: prof?.role ?? null,
        lastActivityAt: st.lastAt,
        totalLogCount: totals.get(userId) ?? st.sampleCount,
        recentSampleCount: st.sampleCount,
      };
    });

    return NextResponse.json({ users, scannedTable: table, scanRowCap: SCAN_LIMIT });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status =
      msg === "Not authenticated" ? 401 : msg === "Not authorized" ? 403 : msg.startsWith("Not ") ? 403 : 500;
    return jsonError(msg, status);
  }
}
