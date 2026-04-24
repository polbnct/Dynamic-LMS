"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCourseById } from "@/lib/supabase/queries/courses.client";
import { getQuizzes, submitQuizAnswers } from "@/lib/supabase/queries/quizzes";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";
import type { Question } from "@/lib/supabase/queries/quizzes";
import { FillBlankModeTag, FillBlankSymbolBank } from "@/components/study/FillBlankSupport";

export default function TakeQuizPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const quizId = params.quizId as string;
  const formatType = (type: string) => {
  switch (type) {
    case "fill_blank":
      return "Fill in the Blank";
    case "multiple_choice":
      return "Multiple Choice";
    case "true_false":
      return "True or False";
    default:
      return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
};

  const [course, setCourse] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [lockTimeRemaining, setLockTimeRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");

  const submitQuizRef = useRef<() => Promise<void>>(async () => {});

  useSyncMessagesToToast(error, "");

  useEffect(() => {
    if (!attemptId || questions.length === 0) return;

    const logActivity = async (status: "focused" | "blurred") => {
      try {
        await fetch("/api/quiz-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, status }),
        });
      } catch (err) {
        console.error("Failed to log quiz activity:", err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logActivity("blurred");
      } else {
        logActivity("focused");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    logActivity("focused");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [attemptId, questions.length]);

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);

        const quizzesData = await getQuizzes(courseId);
        const foundQuiz = quizzesData.find((q) => q.id === quizId);
        if (!foundQuiz) {
          setError("Quiz not found");
          return;
        }

        setQuiz(foundQuiz);
        setQuestions(foundQuiz.questions || []);
        document.title = `${foundQuiz.name} · Quiz`;

        const res = await fetch("/api/quizzes/start-attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as any;
          throw new Error(data?.error || "Failed to start quiz attempt");
        }
        const data = await res.json();
        const attempt = data?.attempt;
        if (!attempt?.id) throw new Error("Quiz attempt not found");

        attemptIdRef.current = attempt.id;
        setAttemptId(attempt.id);

        if (foundQuiz.time_limit && attempt.started_at) {
          const limitSec = foundQuiz.time_limit * 60;
          const started = new Date(attempt.started_at as string).getTime();
          const elapsed = Math.floor((Date.now() - started) / 1000);
          const left = Math.max(0, limitSec - elapsed);
          setTimeRemaining(left);
          if (left <= 0) {
            queueMicrotask(() => void submitQuizRef.current());
          }
        } else if (foundQuiz.time_limit) {
          setTimeRemaining(foundQuiz.time_limit * 60);
        }

        if (foundQuiz.due_date) {
          const lockAt = new Date(foundQuiz.due_date).getTime();
          if (!Number.isNaN(lockAt)) {
            const left = Math.max(0, Math.floor((lockAt - Date.now()) / 1000));
            setLockTimeRemaining(left);
            if (left <= 0) {
              queueMicrotask(() => void submitQuizRef.current());
            }
          }
        }
      } catch (err: any) {
        console.error("Error fetching quiz:", err);
        setError(err.message || "Failed to load quiz");
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [courseId, quizId]);

  const handleAnswerChange = (questionId: string, answer: string | number | boolean) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };
  const handleFillBlankInsert = (questionId: string, symbol: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: `${String(prev[questionId] ?? "")}${symbol}`,
    }));
  };

  const handleSubmitQuiz = async () => {
    const id = attemptIdRef.current ?? attemptId;
    if (!id) {
      setError("Quiz attempt not found");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));

      await submitQuizAnswers(id, answerArray);
      router.push(`/student/dashboard/${courseId}/quizzes`);
    } catch (err: any) {
      console.error("Error submitting quiz:", err);
      setError(err.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  submitQuizRef.current = handleSubmitQuiz;

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          void submitQuizRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  useEffect(() => {
    if (lockTimeRemaining === null || lockTimeRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          void submitQuizRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockTimeRemaining]);

  const formatTime = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;

  const shell = "min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50";

  if (loading) {
    return (
      <div className={shell}>
        <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
            <p className="mt-4 text-sm font-medium text-gray-600">Preparing your quiz…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className={shell}>
        <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8 max-w-lg mx-auto text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-red-100 to-rose-100 rounded-full mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-800">This quiz is unavailable</p>
            <p className="mt-2 text-sm text-gray-600">{error || "Return to the quiz list and try again."}</p>
            <Link
              href={`/student/dashboard/${courseId}/quizzes`}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-2.5 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Back to quizzes
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const timerUrgent = timeRemaining !== null && timeRemaining > 0 && timeRemaining < 300;
  const lockTimerUrgent = lockTimeRemaining !== null && lockTimeRemaining > 0 && lockTimeRemaining < 300;

  return (
    <div className={`${shell} pb-28 sm:pb-24`}>
      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <header className="mb-8 text-left">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 break-words leading-tight truncate">
            {quiz.name}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {course?.name}
            {course?.code ? ` (${course.code})` : ""}
            <span className="text-gray-400 mx-2" aria-hidden>
              ·
            </span>
            {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
          </p>
        </header>

        <div
          className={`mb-8 grid gap-4 ${
            (timeRemaining !== null && timeRemaining > 0) && (lockTimeRemaining !== null && lockTimeRemaining > 0)
              ? "sm:grid-cols-3"
              : (timeRemaining !== null && timeRemaining > 0) || (lockTimeRemaining !== null && lockTimeRemaining > 0)
                ? "sm:grid-cols-2"
                : "sm:grid-cols-1"
          }`}
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
              {answeredCount} / {totalQuestions}
            </p>
          </div>
          {timeRemaining !== null && timeRemaining > 0 && (
            <div
              className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border px-5 py-4 sm:px-6 sm:py-5 sm:text-right ${
                timerUrgent ? "border-red-200 ring-1 ring-red-100" : "border-gray-200"
              }`}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time remaining</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-red-600">{formatTime(timeRemaining)}</p>
            </div>
          )}
          {lockTimeRemaining !== null && lockTimeRemaining > 0 && (
            <div
              className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border px-5 py-4 sm:px-6 sm:py-5 sm:text-right ${
                lockTimerUrgent ? "border-rose-200 ring-1 ring-rose-100" : "border-gray-200"
              }`}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Locks in</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-rose-600">
                {formatTime(lockTimeRemaining)}
              </p>
            </div>
          )}
        </div>

        <p className="mb-6 text-left text-sm text-gray-600">
          Answer each question below, then submit when you are finished.
        </p>

        <div className="space-y-6">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
            >
              <div className="mb-4">
                <span className="text-sm font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                  Question {index + 1}
                </span>
                <span className="ml-3 text-sm text-gray-500">
                  {formatType(question.type)}
                </span>
                {question.type === "fill_blank" && (
                  <span className="ml-3">
                    <FillBlankModeTag mode={question.fill_blank_answer_mode} />
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-lg font-semibold text-gray-800 mb-4">{question.question}</h2>

              {question.type === "multiple_choice" && Array.isArray(question.options) && question.options.length > 0 && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <label
                      key={optIndex}
                      className={`flex items-start gap-2 p-2 sm:p-3 border rounded-lg cursor-pointer text-xs sm:text-base text-gray-800 transition-colors ${
                        answers[question.id] === optIndex
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200 hover:bg-red-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={optIndex}
                        checked={answers[question.id] === optIndex}
                        onChange={() => handleAnswerChange(question.id, optIndex)}
                        className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-600 shrink-0 mt-1"
                      />
                      <span className="text-sm sm:text-base leading-snug sm:leading-relaxed">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === "true_false" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAnswerChange(question.id, true)}
                    className={`flex-1 py-2 px-2 rounded-lg font-semibold transition-colors ${
                      answers[question.id] === true
                        ? "bg-green-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    True
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnswerChange(question.id, false)}
                    className={`flex-1 py-2 px-2 rounded-lg font-semibold transition-colors ${
                      answers[question.id] === false
                        ? "bg-red-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    False
                  </button>
                </div>
              )}

              {question.type === "fill_blank" && (
                <div>
                  <input
                    type="text"
                    value={(answers[question.id] as string) || ""}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Enter your answer"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <FillBlankSymbolBank
                    mode={question.fill_blank_answer_mode}
                    onInsert={(symbol) => handleFillBlankInsert(question.id, symbol)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/90 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 sm:px-6 lg:px-8 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="order-2 text-center text-xs text-gray-500 sm:order-1 sm:max-w-md sm:text-left">
            Submit when you are ready. Unanswered items may still be submitted.
          </p>
          <button
            type="button"
            onClick={() => void handleSubmitQuiz()}
            disabled={submitting || answeredCount === 0}
            className="order-1 w-full shrink-0 bg-gradient-to-r from-red-600 to-rose-600 py-3 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none sm:order-2 sm:w-auto sm:min-w-[220px]"
          >
            {submitting ? "Submitting…" : "Submit Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}
