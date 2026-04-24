"use client";

import React from "react";
import { DISCRETE_SYMBOL_BANK } from "@/lib/study-aid-symbols";

export type FillBlankAnswerMode = "symbol_only" | "term_only";

export function fillBlankModeLabel(mode?: FillBlankAnswerMode | null): string {
  const safe = mode ?? "term_only";
  if (safe === "symbol_only") return "Symbol only";
  return "Term only";
}

export function FillBlankModeTag({ mode }: { mode?: FillBlankAnswerMode | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
      {fillBlankModeLabel(mode)}
    </span>
  );
}

export function FillBlankSymbolBank({
  mode,
  onInsert,
}: {
  mode?: FillBlankAnswerMode | null;
  onInsert: (symbol: string) => void;
}) {
  const safe = mode ?? "term_only";
  if (safe === "term_only") return null;

  return (
    <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-gray-500">
        Symbol bank (show/hide)
      </summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {DISCRETE_SYMBOL_BANK.map((symbol) => (
          <button
            key={symbol}
            type="button"
            onClick={() => onInsert(symbol)}
            className="inline-flex min-w-8 items-center justify-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-700 hover:border-red-300 hover:bg-red-50"
          >
            {symbol}
          </button>
        ))}
      </div>
    </details>
  );
}

