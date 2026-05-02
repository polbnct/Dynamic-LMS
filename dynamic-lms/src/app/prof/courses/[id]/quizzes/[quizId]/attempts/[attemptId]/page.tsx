"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getQuizAttemptWithAnswers,
  overrideAttemptAnswerCorrectness,
  type QuizResultAnswer,
  type QuizResultWithAnswers,
} from "@/lib/supabase/queries/quizzes";

const formatMcAnswer = (value: unknown, options?: string[]): string => {
  if (!options || options.length === 0) return String(value ?? "");
  const idx =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
        ? Number(value)
        : null;
  if (idx == null || !Number.isFinite(idx)) return String(value ?? "");
  const letter = String.fromCharCode(65 + idx);
  const option = options[idx];
  return option != null ? `${letter}. ${option}` : `${letter}.`;
};

const formatAnswer = (answer: QuizResultAnswer) => {
  if (answer.questionType === "multiple_choice") {
    return {
      user: formatMcAnswer(answer.userAnswer, answer.options),
      correct: formatMcAnswer(answer.correctAnswer, answer.options),
    };
  }
  if (answer.questionType === "true_false") {
    return {
      user:
        typeof answer.userAnswer === "boolean"
          ? answer.userAnswer
            ? "True"
            : "False"
          : String(answer.userAnswer ?? ""),
      correct:
        typeof answer.correctAnswer === "boolean"
          ? answer.correctAnswer
            ? "True"
            : "False"
          : String(answer.correctAnswer ?? ""),
    };
  }
  return {
    user: String(answer.userAnswer ?? ""),
    correct: String(answer.correctAnswer ?? ""),
  };
};

export default function ProfessorAttemptReviewPage() {
  const params = useParams();
  const courseId = params.id as string;
  const quizId = params.quizId as string;
  const attemptId = params.attemptId as string;

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<QuizResultWithAnswers | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingQuestionId, setUpdatingQuestionId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getQuizAttemptWithAnswers(attemptId, { includeCorrectAnswers: true });
        if (!data) {
          setError("Attempt results not found.");
          return;
        }
        if (data.attempt.quiz_id !== quizId) {
          setError("Attempt does not match this quiz.");
          return;
        }
        setResults(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load attempt results.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [attemptId, quizId]);

  const percent = useMemo(() => {
    if (!results?.attempt.max_score) return 0;
    return Math.round(((results.attempt.score ?? 0) / results.attempt.max_score) * 100);
  }, [results]);

  const reviewedCount = useMemo(() => results?.answers.length ?? 0, [results]);
  const correctCount = useMemo(
    () => (results?.answers || []).filter((a) => a.isCorrect).length,
    [results]
  );
  const wrongCount = Math.max(reviewedCount - correctCount, 0);

  const handleOverride = async (questionId: string, nextIsCorrect: boolean) => {
    if (!results) return;
    setNotice("");
    setError("");
    setUpdatingQuestionId(questionId);
    try {
      const updated = await overrideAttemptAnswerCorrectness({
        attemptId,
        questionId,
        isCorrect: nextIsCorrect,
        quizId,
        courseId,
      });
      setResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          attempt: {
            ...prev.attempt,
            score: updated.score,
            max_score: updated.maxScore,
          },
          answers: prev.answers.map((row) =>
            row.questionId === questionId ? { ...row, isCorrect: updated.isCorrect } : row
          ),
        };
      });
      setNotice("Saved. Score updated.");
    } catch (err: any) {
      setError(err?.message || "Failed to save review.");
    } finally {
      setUpdatingQuestionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Professor Review</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Quiz Attempt Review</h1>
              <p className="mt-2 break-all text-sm text-slate-600">Attempt ID: {attemptId}</p>
            </div>
            <Link
              href={`/prof/courses/${courseId}/quizzes`}
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              Back to quizzes
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : !results ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            No results found.
          </div>
        ) : (
          <div className="space-y-6">
            {notice && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
                {notice}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {results.attempt.score ?? 0}
                  <span className="ml-1 text-base font-semibold text-slate-500">/ {results.attempt.max_score ?? 0}</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-red-700">{percent}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correct</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{correctCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs Review</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{wrongCount}</p>
              </div>
            </div>

            <div className="space-y-4">
              {results.answers.map((answer, index) => {
                const formatted = formatAnswer(answer);
                const updating = updatingQuestionId === answer.questionId;
                return (
                  <div
                    key={`${answer.questionId}-${index}`}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                      answer.isCorrect ? "border-green-200" : "border-red-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-base font-semibold text-slate-900">
                          {index + 1}. {answer.questionText}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Type: {answer.questionType.replace("_", " ")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          answer.isCorrect
                            ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                            : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                        }`}
                      >
                        {answer.isCorrect ? "Correct" : "Wrong"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student Answer</p>
                        <p className="mt-1 break-words text-slate-900">{formatted.user}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correct Answer</p>
                        <p className="mt-1 break-words text-slate-900">{formatted.correct}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updating || answer.isCorrect}
                        onClick={() => void handleOverride(answer.questionId, true)}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updating ? "Saving..." : "Mark as Correct"}
                      </button>
                      <button
                        type="button"
                        disabled={updating || !answer.isCorrect}
                        onClick={() => void handleOverride(answer.questionId, false)}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updating ? "Saving..." : "Mark as Wrong"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
