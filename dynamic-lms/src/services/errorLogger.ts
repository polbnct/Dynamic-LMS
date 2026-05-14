/**
 * Centralized frontend logging for:
 * - Runtime JS errors (window "error" — sync throws in non-React code, script load failures, etc.)
 * - Unhandled Promise rejections (window "unhandledrejection" — async failures never caught)
 * - React render/lifecycle errors (ErrorBoundary — these do NOT bubble to window.onerror)
 * - Optional explicit user actions via logUserAction (navigation, submits, toggles, etc.)
 *
 * Example payload shape (category "error"):
 * {
 *   "category": "error",
 *   "type": "WINDOW_ERROR",
 *   "message": "Cannot read properties of undefined",
 *   "technicalMessage": "stack trace here",
 *   "timestamp": "2026-05-15T09:01:11.000Z",
 *   "date": "5/15/2026",
 *   "time": "5:01:11 PM",
 *   "page": "/dashboard",
 *   "url": "https://app.example.com/dashboard",
 *   "userAgent": "Mozilla/5.0"
 * }
 */

import type { FrontendLogPayload } from "@/types/errorLog";

const INGEST_URL = "/api/error-logs";
const TECH_MAX = 12_000;
const SESSION_KEY = "lms_frontend_log_session_id";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function axiosLikeMessage(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const response = error.response;
  if (!isRecord(response)) return null;
  const data = response.data;
  if (!isRecord(data)) return null;
  const msg = data.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : null;
}

/** Readable message: axios-style response, then Error.message, then fallback. */
export function getErrorMessage(error: unknown): string {
  return axiosLikeMessage(error) ?? (error instanceof Error ? error.message : null) ?? "Unexpected system error";
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function nowParts(): { timestamp: string; date: string; time: string } {
  const d = new Date();
  return {
    timestamp: d.toISOString(),
    date: d.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }),
  };
}

function browserContext(): Pick<FrontendLogPayload, "page" | "url" | "userAgent"> {
  if (typeof window === "undefined") {
    return { page: "", url: "", userAgent: "" };
  }
  return {
    page: window.location.pathname,
    url: window.location.href,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

function getOrCreateSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function appVersion(): string | null {
  const v = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  return v || null;
}

function technicalFromError(error: unknown): string | null {
  if (error instanceof Error) {
    const stack = error.stack ?? error.message;
    return truncate(stack, TECH_MAX);
  }
  try {
    return truncate(JSON.stringify(error), TECH_MAX);
  } catch {
    return null;
  }
}

function sendPayload(payload: FrontendLogPayload): void {
  try {
    const body = JSON.stringify(payload);
    void fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    })
      .then((res) => {
        if (res.ok) return;
        if (process.env.NODE_ENV === "development") {
          console.warn("[errorLogger] ingest failed", res.status, INGEST_URL);
        }
      })
      .catch(() => {});
  } catch {
    /* never throw from logger */
  }
}

/** Log an unexpected error (global handlers, ErrorBoundary, catch blocks). */
export function logFrontendError(error: unknown, type = "MANUAL"): void {
  try {
    const { timestamp, date, time } = nowParts();
    const ctx = browserContext();
    const payload: FrontendLogPayload = {
      category: "error",
      type,
      message: getErrorMessage(error),
      technicalMessage: technicalFromError(error),
      timestamp,
      date,
      time,
      ...ctx,
      sessionId: getOrCreateSessionId(),
      appVersion: appVersion(),
      metadata: null,
    };
    sendPayload(payload);
  } catch {
    /* swallow */
  }
}

/** Log an intentional user action (call from event handlers, after navigation, etc.). */
export function logUserAction(action: string, details?: Record<string, unknown>): void {
  try {
    const { timestamp, date, time } = nowParts();
    const ctx = browserContext();
    let technical: string | null = null;
    if (details && Object.keys(details).length > 0) {
      try {
        technical = truncate(JSON.stringify(details), TECH_MAX);
      } catch {
        technical = null;
      }
    }
    const summary =
      details && typeof details.summary === "string"
        ? details.summary
        : `${action}${details && Object.keys(details).length ? ` (${Object.keys(details).slice(0, 3).join(", ")})` : ""}`;

    const payload: FrontendLogPayload = {
      category: "action",
      type: action,
      message: summary.slice(0, 500),
      technicalMessage: technical,
      timestamp,
      date,
      time,
      ...ctx,
      sessionId: getOrCreateSessionId(),
      appVersion: appVersion(),
      metadata: details ?? null,
    };
    sendPayload(payload);
  } catch {
    /* swallow */
  }
}

/** Convenience for failed fetch/axios calls in try/catch. */
export function logApiError(error: unknown, context?: string): void {
  try {
    const msg = getErrorMessage(error);
    const { timestamp, date, time } = nowParts();
    const ctx = browserContext();
    const meta: Record<string, unknown> = {};
    if (context) meta.context = context;
    const tech = technicalFromError(error);
    const payload: FrontendLogPayload = {
      category: "error",
      type: "API_FAILURE",
      message: msg,
      technicalMessage: tech,
      timestamp,
      date,
      time,
      ...ctx,
      sessionId: getOrCreateSessionId(),
      appVersion: appVersion(),
      metadata: Object.keys(meta).length ? meta : null,
    };
    sendPayload(payload);
  } catch {
    /* swallow */
  }
}
