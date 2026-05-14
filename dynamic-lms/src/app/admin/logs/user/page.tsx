"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShellHeader } from "@/components/admin/AdminShellHeader";
import type { FrontendLogListItem, LogUserSummary } from "@/types/errorLog";

function mergeLogsById(
  prev: FrontendLogListItem[],
  incoming: FrontendLogListItem[],
  reset: boolean
): FrontendLogListItem[] {
  if (reset) return incoming;
  const seen = new Set(prev.map((r) => r.id));
  const out = [...prev];
  for (const row of incoming) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

async function fetchLogs(params: {
  limit: number;
  offset: number;
  userId: string;
  category?: string;
}): Promise<{ logs: FrontendLogListItem[]; total: number; hasMore: boolean }> {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit));
  sp.set("offset", String(params.offset));
  sp.set("userId", params.userId);
  if (params.category) sp.set("category", params.category);
  const res = await fetch(`/api/admin/logs?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as { logs: FrontendLogListItem[]; total: number; hasMore: boolean };
}

async function fetchSummary(userId: string): Promise<LogUserSummary> {
  const res = await fetch(`/api/admin/logs/user-summary?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return (data as { summary: LogUserSummary }).summary;
}

function roleLabel(role: string | null): string {
  if (!role) return "—";
  if (role === "professor") return "Professor";
  if (role === "student") return "Student";
  if (role === "admin") return "Admin";
  return role;
}

function logMatchesSearch(row: FrontendLogListItem, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const parts = [
    row.message,
    row.type,
    row.category,
    row.page,
    row.url,
    row.technicalMessage,
    row.userAgent,
    row.appVersion,
    row.sessionId,
    row.dateDisplay,
    row.timeDisplay,
  ]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .map((x) => x.toLowerCase());
  if (parts.some((p) => p.includes(q))) return true;
  if (row.metadata && Object.keys(row.metadata).length > 0) {
    try {
      if (JSON.stringify(row.metadata).toLowerCase().includes(q)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

function groupLogsByDay(logs: FrontendLogListItem[]): { dayKey: string; dayLabel: string; items: FrontendLogListItem[] }[] {
  const map = new Map<string, { dayLabel: string; items: FrontendLogListItem[] }>();
  for (const log of logs) {
    const d = new Date(log.createdAt);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayLabel = d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!map.has(dayKey)) {
      map.set(dayKey, { dayLabel, items: [] });
    }
    map.get(dayKey)!.items.push(log);
  }
  const keys = [...map.keys()].sort((a, b) => (a < b ? 1 : -1));
  return keys.map((dayKey) => {
    const { dayLabel, items } = map.get(dayKey)!;
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { dayKey, dayLabel, items };
  });
}

function UserLogsContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId")?.trim() ?? "";

  const [summary, setSummary] = useState<LogUserSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");

  const [logs, setLogs] = useState<FrontendLogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<"" | "error" | "action">("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");
  const pageSize = 50;
  const fetchOffsetRef = useRef(0);

  const load = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (!userId) return;
      const reset = opts?.reset !== false;
      setError("");
      setLoading(true);
      if (reset) {
        fetchOffsetRef.current = 0;
      }
      const requestOffset = fetchOffsetRef.current;
      try {
        const res = await fetchLogs({
          limit: pageSize,
          offset: requestOffset,
          userId,
          category: category || undefined,
        });
        fetchOffsetRef.current = requestOffset + res.logs.length;
        setLogs((prev) => mergeLogsById(prev, res.logs, reset));
        setHasMore(res.hasMore);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load logs");
      } finally {
        setLoading(false);
      }
    },
    [category, pageSize, userId]
  );

  useEffect(() => {
    setSearchText("");
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("Missing userId in URL. Add ?userId=… to the address bar.");
      setLogs([]);
      setHasMore(false);
      setTotal(0);
      setSummary(null);
      return;
    }
    setSummaryError("");
    void fetchSummary(userId)
      .then(setSummary)
      .catch((e) => setSummaryError(e instanceof Error ? e.message : "Failed to load profile"));
    void load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userId + category
  }, [userId, category]);

  const loadMore = () => void load({ reset: false });

  const filteredLogs = useMemo(
    () => logs.filter((row) => logMatchesSearch(row, searchText)),
    [logs, searchText]
  );

  const byDay = useMemo(() => groupLogsByDay(filteredLogs), [filteredLogs]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!userId) {
    return (
      <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-slate-900 antialiased">
        <AdminShellHeader
          trailing={
            <Link
              href="/admin/logs"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 sm:px-4 sm:text-sm"
            >
              Client logs
            </Link>
          }
        />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-red-700">
            A user id is required. Add <code className="font-mono">?userId=…</code> to the URL.
          </p>
          <Link href="/admin/logs" className="mt-4 inline-block text-sm font-medium text-red-700 underline">
            Back to client logs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-slate-900 antialiased">
      <AdminShellHeader
        trailing={
          <Link
            href="/admin/logs"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 sm:px-4 sm:text-sm"
          >
            Client logs
          </Link>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 pt-4 pb-4 sm:px-6 lg:px-8">
        <div className="mb-3 shrink-0 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm shadow-slate-900/5 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">
                {summary ? summary.name : "User activity"}
              </h1>
              <p className="truncate text-sm text-slate-600">{summary?.email ?? "…"}</p>
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-mono text-slate-600">{userId}</span>
                {summary?.role ? (
                  <>
                    {" "}
                    · <span className="font-medium">{roleLabel(summary.role)}</span>
                  </>
                ) : null}
              </p>
              {summary ? (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">{summary.totalLogCount}</span> events
                  <span className="mx-1.5 text-slate-300">|</span>
                  {summary.actionCount} actions
                  <span className="mx-1.5 text-slate-300">|</span>
                  {summary.errorCount} errors
                  {summary.lastActivityAt ? (
                    <>
                      <span className="mx-1.5 text-slate-300">|</span>
                      Last: {new Date(summary.lastActivityAt).toLocaleString()}
                    </>
                  ) : null}
                </p>
              ) : null}
              {summaryError ? <p className="mt-1 text-xs text-amber-700">{summaryError}</p> : null}
              <p className="mt-1 text-xs text-slate-500">
                Loaded <span className="font-medium text-slate-700">{logs.length}</span> of{" "}
                <span className="font-medium text-slate-700">{total}</span> events (search applies to loaded rows;
                load more for older)
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as "" | "error" | "action");
                  setSearchText("");
                  setLogs([]);
                  setExpanded({});
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:outline-none focus-visible:ring-0"
              >
                <option value="">All categories</option>
                <option value="error">Errors only</option>
                <option value="action">Actions only</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:gap-3">
            <label htmlFor="user-log-search" className="sr-only">
              Search this user&apos;s loaded events
            </label>
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                id="user-log-search"
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search loaded events (message, type, page, URL, metadata…)"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-16 text-sm shadow-sm placeholder:text-slate-400 focus:border-red-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
              />
              {searchText ? (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {logs.length > 0 ? (
              <p className="shrink-0 whitespace-nowrap text-xs text-slate-500 sm:text-right">
                {searchText.trim() ? (
                  <>
                    <span className="font-semibold text-slate-800">{filteredLogs.length}</span> match
                    <span className="text-slate-400"> · </span>
                    {logs.length} loaded
                  </>
                ) : (
                  <>{logs.length} loaded</>
                )}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5">
          {error ? (
            <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {loading && logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-sm text-slate-500">
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-red-600" />
                Loading timeline…
              </div>
            ) : logs.length === 0 ? (
              <div className="py-14 text-center text-sm text-slate-500">No logs for this user with the current filter.</div>
            ) : filteredLogs.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-6 py-10 text-center">
                <p className="text-sm font-medium text-amber-900">No matches in loaded events</p>
                <p className="mt-2 text-sm text-amber-800/90">
                  Nothing in the current list matches{" "}
                  <span className="font-mono font-semibold">&quot;{searchText.trim()}&quot;</span>. Try different words,
                  clear the search, or use <span className="font-medium">Load older events</span> to pull in more rows
                  first.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-900 shadow ring-1 ring-amber-200 hover:bg-amber-50"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {byDay.map((day) => (
                  <section key={day.dayKey} className="rounded-xl border border-slate-200/80 bg-slate-50/30">
                    <div className="border-b border-slate-200/80 bg-slate-100/60 px-4 py-2.5 sm:px-5">
                      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">{day.dayLabel}</h2>
                      <p className="text-xs text-slate-500">{day.items.length} event(s)</p>
                    </div>
                    <ul className="divide-y divide-slate-100 bg-white">
                      {day.items.map((row) => {
                        const open = expanded[row.id];
                        const hasDetail =
                          Boolean(row.technicalMessage) || (row.metadata && Object.keys(row.metadata).length > 0);
                        return (
                          <li key={row.id} className="px-4 py-3 sm:px-5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <time className="whitespace-nowrap text-xs font-mono text-slate-500">
                                    {new Date(row.createdAt).toLocaleTimeString()}
                                  </time>
                                  <span className="select-none rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                                    {row.category}
                                  </span>
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800">
                                    {row.type}
                                  </span>
                                </div>
                                <p className="mt-1.5 text-sm font-medium text-slate-900">{row.message}</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Page: <span className="font-mono text-slate-700">{row.page || "—"}</span>
                                </p>
                              </div>
                              {hasDetail ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(row.id)}
                                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  {open ? "Hide detail" : "Detail"}
                                </button>
                              ) : null}
                            </div>
                            {open && hasDetail ? (
                              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs">
                                {row.technicalMessage ? (
                                  <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-slate-700">
                                    {row.technicalMessage}
                                  </pre>
                                ) : null}
                                {row.metadata && Object.keys(row.metadata).length > 0 ? (
                                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-slate-600">
                                    {JSON.stringify(row.metadata, null, 2)}
                                  </pre>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>

          {hasMore ? (
            <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void loadMore()}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Load older events"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminLogsUserPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <UserLogsContent />
    </Suspense>
  );
}
