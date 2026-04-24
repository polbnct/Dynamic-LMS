export const DISCRETE_SYMBOL_ALIASES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bunion\b/gi, replacement: "∪" },
  { pattern: /\bintersect(ion)?\b/gi, replacement: "∩" },
  { pattern: /\bsubseteq\b/gi, replacement: "⊆" },
  { pattern: /\bsubset\b/gi, replacement: "⊂" },
  { pattern: /\bnotin\b/gi, replacement: "∉" },
  { pattern: /\bin\b/gi, replacement: "∈" },
  { pattern: /\bemptyset\b/gi, replacement: "∅" },
  { pattern: /<=/g, replacement: "⊆" },
  { pattern: /!=/g, replacement: "≠" },
];

export const DISCRETE_SYMBOL_BANK = [
  "∪",
  "∩",
  "⊆",
  "⊂",
  "⊇",
  "⊃",
  "∈",
  "∉",
  "∅",
  "∀",
  "∃",
  "¬",
  "∧",
  "∨",
  "→",
  "↔",
  "≠",
  "≤",
  "≥",
] as const;

export type FillBlankAnswerMode = "symbol_only" | "term_only";

export function normalizeStudyAidExpression(raw: unknown): string {
  let text = String(raw ?? "").trim().toLowerCase();
  if (!text) return "";

  for (const { pattern, replacement } of DISCRETE_SYMBOL_ALIASES) {
    text = text.replace(pattern, replacement);
  }

  // Normalize common ASCII operators and whitespace variants.
  text = text
    .replace(/\s*u\s*/g, "∪")
    .replace(/\s*n\s*/g, "∩")
    .replace(/\s*×\s*/g, "×")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s+/g, "");

  return text;
}

export function areStudyAidAnswersEquivalent(studentAnswer: unknown, expectedAnswer: unknown): boolean {
  return normalizeStudyAidExpression(studentAnswer) === normalizeStudyAidExpression(expectedAnswer);
}

function hasSymbolCharacter(raw: unknown): boolean {
  const text = String(raw ?? "");
  if (!text) return false;
  return DISCRETE_SYMBOL_BANK.some((symbol) => text.includes(symbol));
}

export function evaluateFillBlankAnswerByMode(
  studentAnswer: unknown,
  expectedAnswer: unknown,
  mode?: FillBlankAnswerMode | null
): boolean {
  const answerMode = mode ?? "term_only";
  const equivalent = areStudyAidAnswersEquivalent(studentAnswer, expectedAnswer);
  if (!equivalent) return false;

  if (answerMode === "symbol_only") {
    return hasSymbolCharacter(studentAnswer);
  }
  if (answerMode === "term_only") {
    return !hasSymbolCharacter(studentAnswer);
  }
  return true;
}

