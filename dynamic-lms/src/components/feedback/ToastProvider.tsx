"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastKind = "success" | "error" | "info";

type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  show: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const timeoutsRef = useRef<Record<number, number>>({});

  const show = useCallback((kind: ToastKind, message: string) => {
    const trimmed = message?.trim();
    if (!trimmed) return;

    const duration = kind === "error" ? 6500 : 4500;

    setToasts((current) => {
      const existing = current.find(
        (t) => t.kind === kind && t.message === trimmed
      );
      if (existing) {
        const oldTimeout = timeoutsRef.current[existing.id];
        if (oldTimeout) {
          clearTimeout(oldTimeout);
        }

        timeoutsRef.current[existing.id] = window.setTimeout(() => {
          remove(existing.id);
          delete timeoutsRef.current[existing.id];
        }, duration);

        return current;
      }
      
      const id = ++idRef.current;

      timeoutsRef.current[id] = window.setTimeout(() => {
        remove(id);
        delete timeoutsRef.current[id];
      }, duration);

      return [...current, { id, kind, message: trimmed }];
    });
  }, [remove]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-0 top-0 z-[300] flex w-full max-w-md flex-col gap-2 p-4 sm:p-5"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-[toast-in_0.25s_ease-out] ${
              t.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : t.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-sky-200 bg-sky-50 text-sky-900"
            }`}
          >
            <span className="mt-0.5 shrink-0" aria-hidden>
              {t.kind === "success" ? (
                <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : t.kind === "error" ? (
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </span>
            <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 rounded-lg p-1 text-current opacity-60 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  const { show } = ctx;
  return useMemo(
    () => ({
      success: (message: string) => show("success", message),
      error: (message: string) => show("error", message),
      info: (message: string) => show("info", message),
    }),
    [show]
  );
}

/**
 * Mirrors string error/success state into global toasts so all roles get consistent feedback.
 */
export function useSyncMessagesToToast(error: string, success: string) {
  const { error: showError, success: showSuccess } = useToast();

  useEffect(() => {
    if (error) {
        showError(error);
      }
  }, [error, showError]);

  useEffect(() => {
    if (success) {
      showSuccess(success);
    }
  }, [success, showSuccess]);
}

