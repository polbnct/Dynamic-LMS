"use client";

import { ApiFetchActionLogger } from "@/components/ApiFetchActionLogger";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NavigationActionLogger } from "@/components/NavigationActionLogger";
import { RuntimeErrorListeners } from "@/components/RuntimeErrorListeners";
import { UiActionLogger } from "@/components/UiActionLogger";
import { ToastProvider } from "@/components/feedback/ToastProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <RuntimeErrorListeners />
      <ToastProvider>
        <NavigationActionLogger />
        <ApiFetchActionLogger />
        <UiActionLogger />
        {children}
      </ToastProvider>
    </ErrorBoundary>
  );
}
