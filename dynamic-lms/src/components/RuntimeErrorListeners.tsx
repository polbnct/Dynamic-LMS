"use client";

import { useEffect } from "react";
import { logFrontendError } from "@/services/errorLogger";

/**
 * Registers window-level handlers for errors that never reach React
 * (e.g. sync throws outside components, script errors, unhandled rejections).
 */
export function RuntimeErrorListeners() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      const err = ev.error instanceof Error ? ev.error : new Error(ev.message || "window error");
      logFrontendError(err, "WINDOW_ERROR");
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      logFrontendError(ev.reason ?? new Error("unhandled rejection"), "UNHANDLED_REJECTION");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
