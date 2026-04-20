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

type ToastItem = { id: number; kind: ToastKind; message: string; leaving?: boolean };

type ToastContextValue = {
  show: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) =>
      t.map((x) => (x.id === id ? { ...x, leaving: true } : x))
    );

    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 300);
  }, []);

  const timeoutsRef = useRef<Record<number, number>>({});

  const show = useCallback((kind: ToastKind, message: string) => {
  const trimmed = message?.trim();
    if (!trimmed) return;

    const duration = kind === "error" ? 4000 : 4500;

    setToasts((current) => {
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
        className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center px-4"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.length > 0 && (
          <div className="absolute inset-0 bg-black/30" />
        )}

        <div className="relative z-10">
          {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto w-[90vw] max-w-[420px] min-h-[240px] sm:min-h-[260px] flex flex-col items-center justify-center rounded-3xl px-6 sm:px-10 py-7 sm:py-9 bg-white text-gray-800 shadow-2xl   ${
              t.leaving
                ? "animate-[modal-out_0.3s_ease-in]"
                : "animate-[modal-in_0.3s_ease-out]"
            }`}
          >
            <div className="flex flex-col items-center text-center gap-5">
              <div className="animate-[fadeIn_0.2s_ease-out_0.1s_both]">
                {t.kind === "success" && (
                  <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-emerald-100 animate-[icon-in_0.35s_ease-out]">
                    <svg className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}

                {t.kind === "error" && (
                  <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-emerald-100 animate-[icon-in_0.35s_ease-out]">
                    <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                    </svg>
                  </div>
                )}

                {t.kind === "info" && (
                  <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-emerald-100 animate-[icon-in_0.35s_ease-out]">
                    <svg className="h-8 w-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4" />
                    </svg>
                  </div>
                )}
              </div>

              <p className="text-lg sm:text-xl font-semibold">
                {t.kind === "success"
                  ? "Success"
                  : t.kind === "error"
                  ? "Error"
                  : "Notice"}
              </p>

              <p className="text-gray-600 leading-relaxed text-sm px-2">
                {t.message}
              </p>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="mt-2 rounded-xl border border-slate-200 rounded-lg bg-white px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        ))}
      </div>
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

