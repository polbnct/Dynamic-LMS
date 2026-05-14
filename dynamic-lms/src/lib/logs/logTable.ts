/** Primary table name; older DBs may still have {@link LEGACY_LOG_TABLE}. */
export const LOG_TABLE = "logs" as const;
export const LEGACY_LOG_TABLE = "frontend_logs" as const;

export function isMissingLogTableError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  if (m.includes("schema cache") && m.includes("logs")) return true;
  if (m.includes("relation") && m.includes("does not exist")) return true;
  return false;
}
