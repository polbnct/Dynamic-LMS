import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { FrontendLogListItem } from "@/types/errorLog";
import { isMissingLogTableError, LEGACY_LOG_TABLE, LOG_TABLE } from "@/lib/logs/logTable";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseLimit(v: string | null, def: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(Math.floor(n), max);
}

function parseOffset(v: string | null): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 50, 100);
    const offset = parseOffset(searchParams.get("offset"));
    const userIdFilter = searchParams.get("userId")?.trim() || null;
    const categoryRaw = searchParams.get("category")?.trim();
    const category =
      categoryRaw === "error" || categoryRaw === "action" ? categoryRaw : null;

    const selectCols =
      "id, category, type, message, technical_message, occurred_at, date_display, time_display, page, url, user_agent, user_id, session_id, app_version, metadata, created_at";

    const run = (table: string) => {
      let q = admin
        .from(table)
        .select(selectCols, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (userIdFilter) {
        q = q.eq("user_id", userIdFilter);
      }
      if (category) {
        q = q.eq("category", category);
      }
      return q;
    };

    let { data: rows, error, count } = await run(LOG_TABLE);
    if (error && isMissingLogTableError(error)) {
      ({ data: rows, error, count } = await run(LEGACY_LOG_TABLE));
    }

    if (error) {
      return jsonError(error.message, 500);
    }

    const userIds = [...new Set((rows ?? []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean))] as string[];
    const userById: Record<string, { name: string; email: string; role: string | null }> = {};
    if (userIds.length > 0) {
      const { data: users, error: uErr } = await admin.from("users").select("id, name, email, role").in("id", userIds);
      if (uErr) {
        return jsonError(uErr.message, 500);
      }
      for (const u of users ?? []) {
        const row = u as { id: string; name: string; email: string; role: string | null };
        userById[row.id] = { name: row.name ?? "", email: row.email ?? "", role: row.role ?? null };
      }
    }

    const logs: FrontendLogListItem[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const uid = (r.user_id as string | null) ?? null;
      const u = uid ? userById[uid] : null;
      return {
        id: r.id as string,
        category: r.category as FrontendLogListItem["category"],
        type: r.type as string,
        message: r.message as string,
        technicalMessage: (r.technical_message as string | null) ?? null,
        occurredAt: r.occurred_at as string,
        dateDisplay: (r.date_display as string | null) ?? null,
        timeDisplay: (r.time_display as string | null) ?? null,
        page: (r.page as string | null) ?? null,
        url: (r.url as string | null) ?? null,
        userAgent: (r.user_agent as string | null) ?? null,
        userId: uid,
        userName: u?.name ?? null,
        userEmail: u?.email ?? null,
        userRole: u?.role ?? null,
        sessionId: (r.session_id as string | null) ?? null,
        appVersion: (r.app_version as string | null) ?? null,
        metadata: (r.metadata as Record<string, unknown> | null) ?? null,
        createdAt: r.created_at as string,
      };
    });

    const total = count ?? logs.length;
    const hasMore = offset + logs.length < total;

    return NextResponse.json({ logs, total, hasMore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status =
      msg === "Not authenticated" ? 401 : msg === "Not authorized" ? 403 : msg.startsWith("Not ") ? 403 : 500;
    return jsonError(msg, status);
  }
}
