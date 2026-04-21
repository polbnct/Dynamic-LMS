export type QuestionSignatureInput = {
  type: "multiple_choice" | "true_false" | "fill_blank" | "summary";
  question: string;
  options?: string[] | null;
  correctAnswer?:
    | string
    | number
    | boolean
    | {
        answer: string | number | boolean;
        correct_explanation?: string;
        incorrect_explanation?: string;
      }
    | null;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function buildQuestionSignature(input: QuestionSignatureInput): string {
  const normalizedQuestion = normalizeText(input.question || "");
  // Dedupe is intentionally question-stem-only.
  // Options and answers are ignored by design.
  return normalizedQuestion;
}
