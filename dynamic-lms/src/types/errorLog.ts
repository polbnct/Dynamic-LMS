/** Stored / sent log category */
export type FrontendLogCategory = "error" | "action";

/** Common `type` values for automatic error capture */
export type FrontendErrorLogType =
  | "WINDOW_ERROR"
  | "UNHANDLED_REJECTION"
  | "REACT_RENDER"
  | "API_FAILURE"
  | "MANUAL";

/** Prefer stable action keys (NAVIGATE, FORM_SUBMIT, …) when calling logUserAction */
export type FrontendActionLogType = string;

/** Body sent from browser to POST /api/error-logs */
export type FrontendLogPayload = {
  category: FrontendLogCategory;
  /** Event subtype, e.g. WINDOW_ERROR or a custom action key */
  type: string;
  message: string;
  technicalMessage: string | null;
  timestamp: string;
  date: string;
  time: string;
  page: string;
  url: string;
  userAgent: string;
  /** Ignored by server when session exists; optional for future use */
  userId?: string | null;
  sessionId?: string | null;
  appVersion?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Row returned to admin UI (camelCase JSON) */
export type FrontendLogListItem = {
  id: string;
  category: FrontendLogCategory;
  type: string;
  message: string;
  technicalMessage: string | null;
  occurredAt: string;
  dateDisplay: string | null;
  timeDisplay: string | null;
  page: string | null;
  url: string | null;
  userAgent: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  /** From `public.users.role` when joined */
  userRole: string | null;
  sessionId: string | null;
  appVersion: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

/** Admin directory: one row per account that has client logs */
export type LogUserDirectoryEntry = {
  userId: string;
  name: string;
  email: string;
  role: string | null;
  lastActivityAt: string;
  /** Total rows in `logs` for this user (exact when under scan cap) */
  totalLogCount: number;
  /** How many of the scanned recent rows belonged to this user */
  recentSampleCount: number;
};

/** Header + stats for `/admin/logs/user` */
export type LogUserSummary = {
  userId: string;
  name: string;
  email: string;
  role: string | null;
  totalLogCount: number;
  errorCount: number;
  actionCount: number;
  lastActivityAt: string | null;
};
