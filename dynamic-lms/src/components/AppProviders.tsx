"use client";

import { ToastProvider } from "@/components/feedback/ToastProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
