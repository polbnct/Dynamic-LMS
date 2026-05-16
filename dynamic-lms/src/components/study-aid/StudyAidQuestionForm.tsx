"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { StudyAidQuestion } from "@/lib/supabase/queries/study-aid";
import { hasFillBlankMarker } from "@/lib/study-aid/validate";

export type StudyAidQuestionTypeOption =
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "summary";

export type StudyAidQuestionUpdates = {
  type?: StudyAidQuestionTypeOption;
  question?: string;
  options?: string[];
  fill_blank_answer_mode?: "symbol_only" | "term_only" | null;
  correct_answer?:
    | number
    | boolean
    | string
    | {
        answer: number | boolean | string;
        correct_explanation?: string;
        incorrect_explanation?: string;
      };
};

function emptyQuestionForType(type: StudyAidQuestionTypeOption): StudyAidQuestion {
  return {
    id: "new",
    type,
    question: "",
    options: type === "multiple_choice" ? ["", "", "", ""] : undefined,
    correct_answer: type === "multiple_choice" ? 0 : "",
    fill_blank_answer_mode: type === "fill_blank" ? "term_only" : null,
  };
}

export function StudyAidQuestionForm({
  mode,
  question: initialQuestion,
  allowedTypes = ["multiple_choice", "true_false", "fill_blank", "summary"],
  lockType = false,
  onSave,
  onCancel,
  saving,
  submitLabel,
}: {
  mode: "create" | "edit";
  question?: StudyAidQuestion;
  allowedTypes?: StudyAidQuestionTypeOption[];
  lockType?: boolean;
  onSave: (updates: StudyAidQuestionUpdates) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  submitLabel?: string;
}) {
  const seed = useMemo(
    () => initialQuestion ?? emptyQuestionForType(allowedTypes[0] ?? "multiple_choice"),
    [initialQuestion, allowedTypes]
  );

  const normalizedCorrectAnswer =
    seed.correct_answer &&
    typeof seed.correct_answer === "object" &&
    "answer" in seed.correct_answer
      ? seed.correct_answer.answer
      : seed.correct_answer;

  const [questionText, setQuestionText] = useState(seed.question);
  const [type, setType] = useState<StudyAidQuestionTypeOption>(seed.type);
  const [options, setOptions] = useState<string[]>(
    seed.type === "multiple_choice" && seed.options?.length
      ? seed.options
      : ["", "", "", ""]
  );
  const [correctAnswerMc, setCorrectAnswerMc] = useState(
    seed.type === "multiple_choice" ? Number(normalizedCorrectAnswer) : 0
  );
  const [correctAnswerFlashcard, setCorrectAnswerFlashcard] = useState(
    seed.type === "true_false" ? String(normalizedCorrectAnswer ?? "") : ""
  );
  const [correctAnswerFill, setCorrectAnswerFill] = useState(
    seed.type === "fill_blank" || seed.type === "summary"
      ? String(normalizedCorrectAnswer ?? "")
      : ""
  );
  const [fillBlankAnswerMode, setFillBlankAnswerMode] = useState<"symbol_only" | "term_only">(
    seed.type === "fill_blank" ? (seed.fill_blank_answer_mode ?? "term_only") : "term_only"
  );
  const [correctFeedback, setCorrectFeedback] = useState(
    seed.correct_answer &&
      typeof seed.correct_answer === "object" &&
      "correct_explanation" in seed.correct_answer
      ? String(seed.correct_answer.correct_explanation || "")
      : ""
  );
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    setQuestionText(seed.question);
    setType(seed.type);
    setOptions(
      seed.type === "multiple_choice" && seed.options?.length
        ? seed.options
        : ["", "", "", ""]
    );
    const answer =
      seed.correct_answer &&
      typeof seed.correct_answer === "object" &&
      "answer" in seed.correct_answer
        ? seed.correct_answer.answer
        : seed.correct_answer;
    setCorrectAnswerMc(seed.type === "multiple_choice" ? Number(answer) : 0);
    setCorrectAnswerFlashcard(seed.type === "true_false" ? String(answer ?? "") : "");
    setCorrectAnswerFill(
      seed.type === "fill_blank" || seed.type === "summary" ? String(answer ?? "") : ""
    );
    setFillBlankAnswerMode(
      seed.type === "fill_blank" ? (seed.fill_blank_answer_mode ?? "term_only") : "term_only"
    );
    setCorrectFeedback(
      seed.correct_answer &&
        typeof seed.correct_answer === "object" &&
        "correct_explanation" in seed.correct_answer
        ? String(seed.correct_answer.correct_explanation || "")
        : ""
    );
    setClientError("");
  }, [seed]);

  const typeLabels: Record<StudyAidQuestionTypeOption, string> = {
    multiple_choice: "Multiple choice",
    true_false: "Flashcard",
    fill_blank: "Fill in the blank",
    summary: "Summary",
  };

  const collectUpdates = (): StudyAidQuestionUpdates | null => {
    const existingAnswerMeta =
      seed.correct_answer &&
      typeof seed.correct_answer === "object" &&
      "answer" in seed.correct_answer
        ? seed.correct_answer
        : null;

    const withExistingExplanation = (answer: number | boolean | string) => ({
      answer,
      correct_explanation: correctFeedback.trim() || undefined,
      incorrect_explanation: existingAnswerMeta?.incorrect_explanation,
    });

    if (type === "fill_blank" && !hasFillBlankMarker(questionText)) {
      setClientError("Include a blank marker (___ or ______) in the question text.");
      return null;
    }

    if (type === "true_false" && !correctAnswerFlashcard.trim()) {
      setClientError("Flashcard back-side explanation is required.");
      return null;
    }

    if (type === "fill_blank" && !correctAnswerFill.trim()) {
      setClientError("Fill-in-the-blank correct answer is required.");
      return null;
    }

    if (type === "multiple_choice") {
      const opts = options.map((o) => o.trim());
      const nonEmpty = opts.filter((o) => o.length > 0);
      if (nonEmpty.length < 2) {
        setClientError("Enter at least two non-empty answer options.");
        return null;
      }
      return {
        question: questionText.trim(),
        type,
        options: opts,
        correct_answer: withExistingExplanation(correctAnswerMc),
      };
    }
    if (type === "true_false") {
      return {
        question: questionText.trim(),
        type,
        correct_answer: withExistingExplanation(correctAnswerFlashcard.trim()),
      };
    }
    if (type === "summary") {
      return {
        question: questionText.trim(),
        type,
        fill_blank_answer_mode: null,
        correct_answer: " ",
      };
    }
    return {
      question: questionText.trim(),
      type,
      fill_blank_answer_mode: fillBlankAnswerMode,
      correct_answer: withExistingExplanation(correctAnswerFill.trim()),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError("");
    const updates = collectUpdates();
    if (!updates) return;
    await onSave(updates);
  };

  const resolvedSubmitLabel =
    submitLabel ?? (mode === "create" ? "Create" : "Save changes");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {type === "true_false"
            ? "Front of flashcard"
            : type === "summary"
              ? "Summary"
              : type === "fill_blank"
                ? "Question (include ______ for the blank)"
                : "Question"}
        </label>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          className="w-full min-h-[120px] rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 sm:min-h-[100px]"
          placeholder={
            type === "true_false"
              ? "Enter the front term or concept..."
              : type === "fill_blank"
                ? "e.g. The union of A and B is written as ______."
                : type === "summary"
                  ? "Enter the lesson summary..."
                  : "Enter the question..."
          }
          required
        />
      </div>

      {!lockType && allowedTypes.length > 1 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Question type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as StudyAidQuestionTypeOption)}
            className="w-full cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900"
          >
            {allowedTypes.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
        </div>
      )}

      {type === "multiple_choice" && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Answer options</p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-700">
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  value={options[i] ?? ""}
                  onChange={(e) =>
                    setOptions((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                />
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Correct answer</p>
            <select
              value={correctAnswerMc}
              onChange={(e) => setCorrectAnswerMc(parseInt(e.target.value, 10))}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900"
            >
              {options.map((opt, i) => (
                <option key={i} value={i}>
                  {String.fromCharCode(65 + i)}. {opt.trim() || "(empty)"}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {type === "true_false" && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Back of flashcard</p>
          <textarea
            value={correctAnswerFlashcard}
            onChange={(e) => setCorrectAnswerFlashcard(e.target.value)}
            className="w-full min-h-[88px] rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
            placeholder="Explanation shown on the back of the flashcard"
            required
          />
        </div>
      )}

      {type === "fill_blank" && (
        <>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Correct answer</p>
            <input
              value={correctAnswerFill}
              onChange={(e) => setCorrectAnswerFill(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900"
              placeholder="Answer that fills the blank"
              required
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Answer mode tag</p>
            <select
              value={fillBlankAnswerMode}
              onChange={(e) =>
                setFillBlankAnswerMode(e.target.value as "symbol_only" | "term_only")
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900"
            >
              <option value="term_only">Term only</option>
              <option value="symbol_only">Symbol only</option>
            </select>
          </div>
        </>
      )}

      {type !== "summary" && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Feedback (optional)</p>
          <textarea
            value={correctFeedback}
            onChange={(e) => setCorrectFeedback(e.target.value)}
            className="w-full min-h-[100px] rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 sm:min-h-[80px]"
            placeholder="Brief feedback for correct answer"
          />
        </div>
      )}

      {clientError && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {clientError}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 cursor-pointer rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-slate-100 sm:flex-none"
        >
          {mode === "create" ? "Clear" : "Cancel"}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 cursor-pointer rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 sm:flex-none"
        >
          {saving ? "Saving..." : resolvedSubmitLabel}
        </button>
      </div>
    </form>
  );
}
