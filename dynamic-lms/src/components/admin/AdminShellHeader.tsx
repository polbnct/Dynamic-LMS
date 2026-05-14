"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AdminShellHeaderProps = {
  /** Extra controls before the Dashboard link (tabs, filters, etc.) */
  trailing?: ReactNode;
};

export function AdminShellHeader({ trailing }: AdminShellHeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
    }
  };

  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white/85 shadow-sm shadow-slate-900/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-3 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-lg font-extrabold text-slate-900 sm:text-xl">LohikAral</p>
            <p className="text-xs font-medium tracking-wide text-slate-500 sm:text-sm">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {trailing}
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 sm:px-4 sm:text-sm"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 sm:px-4 sm:text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
