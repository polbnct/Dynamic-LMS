"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/feedback/ToastProvider";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { getQuizzes, getQuizResults, getQuizAttemptWithAnswers } from "@/lib/supabase/queries/quizzes";
import type { Quiz } from "@/lib/supabase/queries/quizzes";
import type { QuizResultWithAnswers } from "@/lib/supabase/queries/quizzes";

const QUIZ_CATEGORIES = ["prelim", "midterm", "finals"] as const;

function normalizeQuizCategory(
  raw: Quiz["category"]
): (typeof QUIZ_CATEGORIES)[number] {
  return raw && QUIZ_CATEGORIES.includes(raw as (typeof QUIZ_CATEGORIES)[number])
    ? raw
    : "prelim";
}

interface QuizWithUI extends Quiz {
  title: string;
  description?: string;
  category: "prelim" | "midterm" | "finals";
  createdAt: string;
  dueDate?: string;
  timeLimit?: number;
  questionsCount?: number;
  taken?: boolean;
  score?: number;
  maxScore?: number;
  attemptsUsed?: number;
  remainingAttempts?: number | null;
  isLocked?: boolean;
  inProgressAttemptId?: string | null;
}

export default function StudentQuizzesPage() {
  const params = useParams();
  const rawId = params.id as string | undefined;
  const courseId = typeof rawId === "string" && rawId !== "undefined" ? rawId : "";
  const { error: toastError } = useToast();

  const [course, setCourse] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<QuizWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultModalLoading, setResultModalLoading] = useState(false);
  const [resultModalQuizName, setResultModalQuizName] = useState("");
  const [resultModalRevealCorrect, setResultModalRevealCorrect] = useState(false);
  const [resultData, setResultData] = useState<QuizResultWithAnswers | null>(null);

  const loadQuizzesForCourse = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!courseId) {
        console.error("StudentQuizzesPage: invalid course id from route params", rawId);
        toastError("Invalid course link.");
        if (!silent) setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);

        const [quizzesData, studentId] = await Promise.all([
          getQuizzes(courseId),
          getCurrentStudentId(),
        ]);

        if (!studentId) {
          throw new Error("Student not found");
        }

        let statusMap: Record<string, any> = {};
        try {
          const res = await fetch("/api/quizzes/attempt-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId }),
          });
          if (res.ok) {
            const data = (await res.json().catch(() => null)) as any;
            const statuses = Array.isArray(data?.statuses) ? data.statuses : [];
            statusMap = Object.fromEntries(statuses.map((s: any) => [s.quizId, s]));
          }
        } catch {
          statusMap = {};
        }

        const quizzesWithResults = await Promise.all(
          quizzesData.map(async (quiz) => {
            const result = await getQuizResults(quiz.id, studentId);
            const status = statusMap[quiz.id] || {};
            return {
              ...quiz,
              title: quiz.name,
              category: normalizeQuizCategory(quiz.category),
              createdAt: quiz.created_at,
              dueDate: quiz.due_date,
              timeLimit: quiz.time_limit,
              questionsCount: quiz.questions?.length || 0,
              taken: !!result,
              score: result?.score != null ? Number(result.score) : undefined,
              maxScore:
                result?.max_score != null
                  ? Number(result.max_score)
                  : (quiz.questions?.length ?? 0) *
                    (quiz.points_per_question != null ? Number(quiz.points_per_question) : 10),
              attemptsUsed: status.attemptsUsed ?? 0,
              remainingAttempts: status.remainingAttempts ?? null,
              isLocked: status.isLocked ?? false,
              inProgressAttemptId: status.inProgressAttemptId ?? null,
            };
          })
        );

        setQuizzes(quizzesWithResults);
      } catch (err) {
        console.error("Error fetching course:", err);
        toastError(err instanceof Error ? err.message : "Failed to load quizzes.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [courseId, rawId, toastError]
  );

  useEffect(() => {
    void loadQuizzesForCourse();
  }, [loadQuizzesForCourse]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && courseId) {
        void loadQuizzesForCourse({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [courseId, loadQuizzesForCourse]);

  // Group quizzes by category
  const quizzesByCategory = {
    prelim: quizzes.filter((q) => q.category === "prelim"),
    midterm: quizzes.filter((q) => q.category === "midterm"),
    finals: quizzes.filter((q) => q.category === "finals"),
  };

  const categoryLabels = {
    prelim: "Prelim",
    midterm: "Midterm",
    finals: "Finals",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
        <StudentNavbar currentPage="courses" />
        <StudentCourseNavbar courseId={courseId} currentPage="quizzes" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalQuizzes = quizzes.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      {/* Main Student Navbar */}
      <StudentNavbar currentPage="courses" />
      
      {/* Student Course Navbar */}
      <StudentCourseNavbar
        courseId={courseId}
        currentPage="quizzes"
        courseName={course?.name}
        courseCode={course?.code}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-red-600 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 break-words">
              Quizzes
            </h1>
            <p className="text-sm sm:text-base text-gray-600 truncate">
              {course?.name} ({course?.code}) • {totalQuizzes} quiz{totalQuizzes !== 1 ? "zes" : ""}
            </p>
          </div>
        </div>

        {/* Quizzes by Category */}
        {totalQuizzes === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-rose-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No quizzes available</h3>
              <p className="text-gray-600">Quizzes will appear here when your professor adds them</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {(["prelim", "midterm", "finals"] as const).map((category) => {
              const categoryQuizzes = quizzesByCategory[category];
              if (categoryQuizzes.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                      {categoryQuizzes.length} quiz{categoryQuizzes.length !== 1 ? "zes" : ""}
                    </span>
                  </div>

                  {/* Quizzes List */}
                  <div className="space-y-4">
                    {categoryQuizzes.map((quiz) => {
                      const isLocked = quiz.isLocked ?? false;
                      const hasRemainingAttempts =
                        quiz.remainingAttempts === null || (quiz.remainingAttempts ?? 0) > 0;
                      const inProgress = Boolean(quiz.inProgressAttemptId);

                      return (
                      <div
                        key={quiz.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                              <h3 className="text-lg sm:text-xl font-bold text-gray-800 truncate" title={quiz.title}
                              >{quiz.title}</h3>
                              {inProgress && (
                                <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-semibold">
                                  In progress
                                </span>
                              )}
                              {quiz.taken && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                  Completed
                                </span>
                              )}
                            </div>
                            {quiz.description && (
                              <p className="text-gray-600 mb-4 break-words">{quiz.description}</p>
                            )}
                            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-6 text-sm text-gray-600 mb-4">
                              {quiz.questionsCount && (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span>{quiz.questionsCount} questions</span>
                                </div>
                              )}
                              {quiz.timeLimit && (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span>{quiz.timeLimit} minutes</span>
                                </div>
                              )}
                              {quiz.dueDate && (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <span className="break-words">
                                    Locks (PH time):{" "}
                                    {new Date(quiz.dueDate).toLocaleString("en-PH", {
                                      timeZone: "Asia/Manila",
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              )}
                              {quiz.taken && quiz.score !== undefined && quiz.maxScore != null && quiz.maxScore > 0 && (
                                <div className="flex items-center gap-2 text-red-600 font-semibold">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span className="break-words">Score: {quiz.score}/{quiz.maxScore} ({Math.round((quiz.score / quiz.maxScore) * 100)}%)</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Actions: aligned with assignment card buttons (lg:w-56 stack) */}
                          <div className="flex w-full flex-shrink-0 flex-col gap-2 border-t border-gray-100 pt-4 sm:border-t-0 sm:pt-0 lg:ml-0 lg:w-56 lg:border-l lg:border-gray-100 lg:pl-6 lg:pt-0">
                            {inProgress && (
                              <div className="w-full rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3">
                                <p className="text-sm font-semibold text-amber-950">Attempt in progress</p>
                                <p className="mt-1 text-xs text-amber-900/85">
                                  Submit this quiz in its window before you can start or retake it here.
                                </p>
                                <Link
                                  href={`/student/dashboard/${courseId}/quizzes/${quiz.id}/take`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100/80"
                                >
                                  Open quiz window
                                </Link>
                              </div>
                            )}
                            {quiz.taken && (
                              <button
                                type="button"
                                onClick={async () => {
                                  setResultModalQuizName(quiz.name);
                                  const revealCorrect = Boolean((quiz as any).reveal_correct_answers);
                                  setResultModalRevealCorrect(revealCorrect);
                                  setResultModalOpen(true);
                                  setResultModalLoading(true);
                                  setResultData(null);
                                  try {
                                    const studentId = await getCurrentStudentId();
                                    if (!studentId) return;
                                    const attempt = await getQuizResults(quiz.id, studentId);
                                    if (!attempt) return;
                                    const withAnswers = await getQuizAttemptWithAnswers(attempt.id, {
                                      includeCorrectAnswers: revealCorrect,
                                    });
                                    setResultData(withAnswers ?? null);
                                  } catch (err) {
                                    console.error(err);
                                    toastError(err instanceof Error ? err.message : "Failed to load quiz results.");
                                  } finally {
                                    setResultModalLoading(false);
                                  }
                                }}
                                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                View Results
                              </button>
                            )}
                            {inProgress ? null : isLocked ? (
                              <span className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-center text-sm font-medium text-slate-500">
                                Quiz locked
                              </span>
                            ) : hasRemainingAttempts ? (
                              <Link
                                href={`/student/dashboard/${courseId}/quizzes/${quiz.id}/take`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Quiz opens in a new tab"
                                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-3 text-center text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
                              >
                                {quiz.taken ? "Retake Quiz" : "Take Quiz"}
                              </Link>
                            ) : !quiz.taken ? (
                              <span className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-center text-sm font-medium text-slate-500">
                                No attempts remaining
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Quiz Result Modal */}
      {resultModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => setResultModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start sm:items-center justify-between gap-3 p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 min-w-0 flex-1 truncate" title={resultModalQuizName}>
                Quiz Result: {resultModalQuizName}
              </h2>
              <button
                onClick={() => setResultModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
              {resultModalLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent" />
                </div>
              ) : resultData ? (
                <>
                  <div className="text-center mb-6 p-4 bg-red-50 rounded-xl">
                    <p className="text-2xl sm:text-3xl font-bold text-red-600 break-words">
                      {(resultData.attempt.score ?? 0)} / {resultData.attempt.max_score}
                    </p>
                    <p className="text-gray-600 mt-1">
                      {resultData.attempt.max_score > 0 && resultData.attempt.score != null
                        ? Math.round(((resultData.attempt.score ?? 0) / resultData.attempt.max_score) * 100)
                        : 0}
                      %
                    </p>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-3">Questions</h3>
                  <ul className="space-y-4">
                    {resultData.answers.map((a, idx) => {
                      const correctDisplay =
                        a.correctAnswer === undefined
                          ? ""
                          : a.questionType === "multiple_choice" && a.options
                            ? a.options[Number(a.correctAnswer)] ?? String(a.correctAnswer)
                            : typeof a.correctAnswer === "boolean"
                              ? a.correctAnswer
                                ? "True"
                                : "False"
                              : String(a.correctAnswer);
                      const userDisplay =
                        a.questionType === "multiple_choice" && a.options
                          ? (() => {
                              const idx =
                                typeof a.userAnswer === "number"
                                  ? a.userAnswer
                                  : parseInt(String(a.userAnswer), 10);
                              return Number.isFinite(idx) ? (a.options[idx] ?? String(a.userAnswer)) : String(a.userAnswer);
                            })()
                          : typeof a.userAnswer === "boolean"
                            ? a.userAnswer
                              ? "True"
                              : "False"
                            : String(a.userAnswer);
                      return (
                        <li
                          key={a.questionId}
                          className={`p-3 sm:p-4 rounded-xl border-2 ${
                            a.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                                a.isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"
                              }`}
                            >
                              {a.isCorrect ? "✓" : "✗"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 break-words whitespace-normal">
                                {idx + 1}. {a.questionText}
                              </p>
                              <p className="text-sm text-gray-600 mt-1 break-words">
                                Your answer: <span className="font-medium break-all" title={userDisplay}
                                >{userDisplay}</span>
                              </p>
                              {!a.isCorrect && resultModalRevealCorrect && a.correctAnswer !== undefined && (
                                <p className="text-sm text-green-700 mt-0.5 break-words">
                                  Correct answer: <span 
                                  className="font-medium break-all"
                                  title={correctDisplay}
                                  >
                                    {correctDisplay}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">No result data.</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setResultModalOpen(false)}
                className="w-full py-2.5 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

