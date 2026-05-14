import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingLogTableError, LEGACY_LOG_TABLE, LOG_TABLE } from "@/lib/logs/logTable";

export const dynamic = "force-dynamic";

const MAX_BODY = 128_000;
const MAX_MESSAGE = 2000;
const MAX_TYPE = 256;
const MAX_TECH = 14_000;
const MAX_PAGE = 2048;
const MAX_URL = 4096;
const MAX_UA = 2048;
const MAX_SESSION = 128;
const MAX_VERSION = 64;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function clampStr(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(request: NextRequest) {
  try {
    const len = request.headers.get("content-length");
    if (len && Number(len) > MAX_BODY) {
      return jsonError("Payload too large", 413);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return jsonError("Payload too large", 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    if (!isRecord(body)) {
      return jsonError("Invalid body", 400);
    }

    const category = body.category === "error" || body.category === "action" ? body.category : null;
    if (!category) {
      return jsonError("Invalid category", 400);
    }

    const type = clampStr(body.type, MAX_TYPE);
    const message = clampStr(body.message, MAX_MESSAGE);
    if (!type || !message) {
      return jsonError("type and message are required", 400);
    }

    const technicalMessage = clampStr(body.technicalMessage, MAX_TECH);
    const page = clampStr(body.page, MAX_PAGE);
    const url = clampStr(body.url, MAX_URL);
    const userAgent = clampStr(body.userAgent, MAX_UA);
    const sessionId = clampStr(body.sessionId, MAX_SESSION);
    const appVersion = clampStr(body.appVersion, MAX_VERSION);

    let occurredAt = new Date().toISOString();
    if (typeof body.timestamp === "string" && body.timestamp.trim()) {
      const d = new Date(body.timestamp);
      if (!Number.isNaN(d.getTime())) {
        occurredAt = d.toISOString();
      }
    }

    const dateDisplay = clampStr(body.date, 64);
    const timeDisplay = clampStr(body.time, 64);

    let metadata: Record<string, unknown> | null = null;
    if (body.metadata != null) {
      if (!isRecord(body.metadata)) {
        return jsonError("metadata must be an object", 400);
      }
      metadata = body.metadata;
      const metaStr = JSON.stringify(metadata);
      if (metaStr.length > 24_000) {
        return jsonError("metadata too large", 400);
      }
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    let admin;
    try {
      admin = createAdminClient();
    } catch (cfgErr) {
      console.error("[error-logs] createAdminClient failed (check SUPABASE_SERVICE_ROLE_KEY)", cfgErr);
      return jsonError("Server logging misconfigured", 503);
    }

    const row = {
      category,
      type,
      message,
      technical_message: technicalMessage,
      occurred_at: occurredAt,
      date_display: dateDisplay,
      time_display: timeDisplay,
      page,
      url,
      user_agent: userAgent,
      user_id: userId,
      session_id: sessionId,
      app_version: appVersion,
      metadata,
    };

    let { error } = await admin.from(LOG_TABLE).insert(row);
    if (error && isMissingLogTableError(error)) {
      ({ error } = await admin.from(LEGACY_LOG_TABLE).insert(row));
    }

    if (error) {
      console.error("[error-logs]", error.message, error);
      return jsonError("Failed to store log", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[error-logs]", e);
    return jsonError("Unexpected error", 500);
  }
}
