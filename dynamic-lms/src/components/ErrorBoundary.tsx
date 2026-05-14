"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { logFrontendError } from "@/services/errorLogger";

type Props = { children: ReactNode };

type State = { hasError: boolean; error: Error | null };

/**
 * Catches React render/lifecycle errors in the subtree. These do not reach
 * window.onerror; use this boundary plus global listeners for full coverage.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const cs = (info.componentStack ?? "").trim().slice(0, 8000);
    const combined = [error.stack ?? error.message, cs ? `--- componentStack ---\n${cs}` : null]
      .filter(Boolean)
      .join("\n");
    const e = new Error(error.message);
    e.stack = combined;
    logFrontendError(e, "REACT_RENDER");
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="text-sm text-slate-600">An error was reported. You can try again.</p>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
