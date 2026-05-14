"use client";

import { useEffect } from "react";
import { logUserAction } from "@/services/errorLogger";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 45;

function createRateLimiter() {
  const times: number[] = [];
  return () => {
    const now = Date.now();
    while (times.length && times[0] < now - WINDOW_MS) times.shift();
    if (times.length >= MAX_PER_WINDOW) return false;
    times.push(now);
    return true;
  };
}

/**
 * Logs same-origin GET calls to `/api/*` (data loads). Rate-limited to avoid huge
 * volumes; Next.js internal `/_next/*` fetches are ignored.
 */
export function ApiFetchActionLogger() {
  useEffect(() => {
    const allow = createRateLimiter();
    const orig = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const method = (
        init?.method ??
        (input instanceof Request ? input.method : undefined) ??
        "GET"
      ).toUpperCase();

      if (method === "GET") {
        let urlStr = "";
        if (typeof input === "string") urlStr = input;
        else if (input instanceof URL) urlStr = input.href;
        else if (input instanceof Request) urlStr = input.url;

        if (urlStr && !urlStr.startsWith("blob:") && !urlStr.startsWith("data:")) {
          try {
            const u = new URL(urlStr, window.location.origin);
            if (
              u.origin === window.location.origin &&
              u.pathname.startsWith("/api/") &&
              !u.pathname.startsWith("/api/error-logs")
            ) {
              if (allow()) {
                logUserAction("API_GET", {
                  summary: `GET ${u.pathname}`,
                  path: `${u.pathname}${u.search}`.slice(0, 800),
                });
              }
            }
          } catch {
            /* ignore invalid URL */
          }
        }
      }

      return orig(input, init);
    };

    return () => {
      window.fetch = orig;
    };
  }, []);

  return null;
}
