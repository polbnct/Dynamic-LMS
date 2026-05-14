"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { logUserAction } from "@/services/errorLogger";

/**
 * Logs client-side route changes (App Router). Server RSC requests are not exposed here;
 * this is the practical equivalent of “user moved to another page”.
 */
export function NavigationActionLogger() {
  const pathname = usePathname();
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search || "";
    const key = `${pathname}${search}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    const fullUrl = `${window.location.origin}${pathname}${search}`;
    logUserAction("PAGE_VIEW", {
      summary: `Page: ${pathname}${search ? " (with query)" : ""}`,
      path: pathname,
      search: search || undefined,
      url: fullUrl.slice(0, 2000),
    });
  }, [pathname]);

  return null;
}
