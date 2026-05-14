"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShellHeader } from "@/components/admin/AdminShellHeader";
import type { FrontendLogListItem, LogUserDirectoryEntry } from "@/types/errorLog";

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

type Tab = "users" | "all";

async function fetchLogs(params: {
  limit: number;
  offset: number;
  userId?: string;
  category?: string;
}): Promise<{ logs: FrontendLogListItem[]; total: number; hasMore: boolean }> {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit));
  sp.set("offset", String(params.offset));
  if (params.userId) sp.set("userId", params.userId);
  if (params.category) sp.set("category", params.category);
  const res = await fetch(`/api/admin/logs?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as { logs: FrontendLogListItem[]; total: number; hasMore: boolean };
}

async function fetchDirectory(): Promise<{
  users: LogUserDirectoryEntry[];
  scanRowCap: number;
}> {
  const res = await fetch("/api/admin/logs/users");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as { users: LogUserDirectoryEntry[]; scanRowCap: number };
}

function roleLabel(role: string | null): string {
  if (!role) return "—";
  if (role === "professor") return "Professor";
  if (role === "student") return "Student";
  return role;
}

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>("users");

  const [directory, setDirectory] = useState<LogUserDirectoryEntry[]>([]);
  const [scanCap, setScanCap] = useState(0);
  const [dirLoading, setDirLoading] = useState(true);
  const [dirError, setDirError] = useState("");

  const [logs, setLogs] = useState<FrontendLogListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<"" | "error" | "action">("");
  const pageSize = 40;
  const fetchOffsetRef = useRef(0);

  const loadDirectory = useCallback(async () => {
    setDirError("");
    setDirLoading(true);
    try {
      const res = await fetchDirectory();
      setDirectory(res.users);
      setScanCap(res.scanRowCap);
    } catch (e) {
      setDirError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setDirLoading(false);
    }
  }, []);

  const load = useCallback(
    async (opts?: { reset?: boolean }) => {
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
    [category, pageSize]
  );

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (tab !== "all") return;
    void load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tab + category
  }, [tab, category]);

  const loadMore = () => void load({ reset: false });

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-slate-900 antialiased">
      <AdminShellHeader />

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 pt-4 pb-4 sm:px-6 lg:px-8">
        <div className="mb-3 shrink-0 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-sm shadow-slate-900/5">
          <div className="flex flex-col gap-3 px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-slate-900 sm:text-lg">Client logs</h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                {tab === "users"
                  ? "Accounts with activity, newest first"
                  : `All events (${total} in database for current filter)`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex w-full rounded-xl bg-slate-100/90 p-1 sm:w-auto sm:inline-flex"
                role="tablist"
                aria-label="Log views"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "users"}
                  onClick={() => setTab("users")}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none sm:min-w-[7.5rem] ${
                    tab === "users"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  By user
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "all"}
                  onClick={() => {
                    setTab("all");
                    setLogs([]);
                  }}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none sm:min-w-[7.5rem] ${
                    tab === "all"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All events
                </button>
              </div>
              {tab === "all" ? (
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as "" | "error" | "action");
                    setLogs([]);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:outline-none focus-visible:ring-0"
                >
                  <option value="">All categories</option>
                  <option value="error">Errors</option>
                  <option value="action">Actions</option>
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => void loadDirectory()}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5">
          {tab === "users" ? (
            <>
              {dirError ? (
                <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{dirError}</div>
              ) : null}
              {scanCap > 0 && !dirError ? (
                <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs text-slate-600">
                  Directory uses the most recent {scanCap.toLocaleString()} log rows with a signed-in user. Totals per
                  account are exact.
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {dirLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-sm text-slate-500">
                    <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-red-600" />
                    Loading users…
                  </div>
                ) : directory.length === 0 ? (
                  <div className="py-14 text-center text-sm text-slate-500">
                    No logs tied to a user account yet. Anonymous events only appear under{" "}
                    <button type="button" className="font-medium text-red-700 underline" onClick={() => setTab("all")}>
                      All events
                    </button>
                    .
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {directory.map((u) => (
                      <div
                        key={u.userId}
                        className="flex flex-col rounded-2xl border border-slate-200/90 bg-slate-50/40 p-5 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold text-slate-900">{u.name}</p>
                          <p className="truncate text-sm text-slate-600">{u.email}</p>
                          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            {roleLabel(u.role)}
                          </p>
                          <p className="mt-3 text-xs text-slate-500">
                            Last activity:{" "}
                            <span className="font-medium text-slate-700">
                              {new Date(u.lastActivityAt).toLocaleString()}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            <span className="font-semibold text-slate-800">{u.totalLogCount.toLocaleString()}</span>{" "}
                            total events
                          </p>
                        </div>
                        <Link
                          href={`/admin/logs/user?userId=${encodeURIComponent(u.userId)}`}
                          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                        >
                          View activity timeline
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {error ? (
                <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold text-slate-700">Time</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-700">Category</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-700">Type</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-700">Message</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-700">User</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-700">Role</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-700">Page</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-700" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading && logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                          <div className="mx-auto mb-3 flex h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-red-600" />
                          Loading…
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                          No logs yet.
                        </td>
                      </tr>
                    ) : (
                      logs.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                            {new Date(row.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <span className="select-none rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                              {row.category}
                            </span>
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-slate-700">{row.type}</td>
                          <td className="max-w-md truncate px-3 py-2 text-slate-800" title={row.message}>
                            {row.message}
                          </td>
                          <td className="max-w-[160px] truncate px-3 py-2 text-xs text-slate-600">
                            {row.userId ? row.userName || row.userEmail || row.userId : "—"}
                          </td>
                          <td className="max-w-[100px] truncate px-3 py-2 text-xs text-slate-500">
                            {row.userRole ? roleLabel(row.userRole) : "—"}
                          </td>
                          <td className="max-w-[100px] truncate px-3 py-2 text-xs text-slate-500">{row.page || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {row.userId ? (
                              <Link
                                href={`/admin/logs/user?userId=${encodeURIComponent(row.userId)}`}
                                className="text-xs font-medium text-red-700 hover:underline"
                              >
                                Timeline
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
                      {loading ? "Loading…" : "Load more"}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
