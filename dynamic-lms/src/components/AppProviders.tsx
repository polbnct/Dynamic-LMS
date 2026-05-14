"use client";

import { LogRocketProvider } from "@/components/LogRocketProvider";
import { ToastProvider } from "@/components/feedback/ToastProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LogRocketProvider>
      <ToastProvider>{children}</ToastProvider>
    </LogRocketProvider>
  );
}
