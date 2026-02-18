"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { getQuizzes, getQuizResults, getQuizAttemptWithAnswers } from "@/lib/supabase/queries/quizzes";
import type { Quiz } from "@/lib/supabase/queries/quizzes";
import type { QuizResultWithAnswers } from "@/lib/supabase/queries/quizzes";

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
}

export default function StudentQuizzesPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultModalLoading, setResultModalLoading] = useState(false);
  const [resultModalQuizName, setResultModalQuizName] = useState("");
  const [resultData, setResultData] = useState<QuizResultWithAnswers | null>(null);

  useEffect(() => {
    async function fetchCourse() {
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

        // Get quiz results for each quiz
        const quizzesWithResults = await Promise.all(
          quizzesData.map(async (quiz) => {
            const result = await getQuizResults(quiz.id, studentId);
            return {
              ...quiz,
              title: quiz.name,
              category: "prelim" as const, // Default category
              createdAt: quiz.created_at,
              dueDate: quiz.due_date,
              timeLimit: quiz.time_limit,
              questionsCount: quiz.questions?.length || 0,
              taken: !!result,
              score: result?.score != null ? Number(result.score) : undefined,
              maxScore: result?.max_score != null ? Number(result.max_score) : (quiz.questions?.length ?? 0) * 10 || 100,
            };
          })
        );

        setQuizzes(quizzesWithResults);
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <StudentNavbar currentPage="courses" />
        <StudentCourseNavbar courseId={courseId} currentPage="quizzes" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalQuizzes = quizzes.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <Link
            href="/student/courses"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Courses
          </Link>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Quizzes
            </h1>
            <p className="text-gray-600">
              {course?.name} ({course?.code}) • {totalQuizzes} quiz{totalQuizzes !== 1 ? "zes" : ""}
            </p>
          </div>
        </div>

        {/* Quizzes by Category */}
        {totalQuizzes === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="space-y-8">
            {(["prelim", "midterm", "finals"] as const).map((category) => {
              const categoryQuizzes = quizzesByCategory[category];
              if (categoryQuizzes.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                      {categoryQuizzes.length} quiz{categoryQuizzes.length !== 1 ? "zes" : ""}
                    </span>
                  </div>

                  {/* Quizzes List */}
                  <div className="space-y-4">
                    {categoryQuizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-800">{quiz.title}</h3>
                              {quiz.taken && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                  Completed
                                </span>
                              )}
                            </div>
                            {quiz.description && (
                              <p className="text-gray-600 mb-4">{quiz.description}</p>
                            )}
                            <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
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
                                  <span>Due: {new Date(quiz.dueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              {quiz.taken && quiz.score !== undefined && quiz.maxScore != null && quiz.maxScore > 0 && (
                                <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span>Score: {quiz.score}/{quiz.maxScore} ({Math.round((quiz.score / quiz.maxScore) * 100)}%)</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {quiz.taken ? (
                            <button
                              onClick={async () => {
                                setResultModalQuizName(quiz.name);
                                setResultModalOpen(true);
                                setResultModalLoading(true);
                                setResultData(null);
                                try {
                                  const studentId = await getCurrentStudentId();
                                  if (!studentId) return;
                                  const attempt = await getQuizResults(quiz.id, studentId);
                                  if (!attempt) return;
                                  const withAnswers = await getQuizAttemptWithAnswers(attempt.id);
                                  setResultData(withAnswers ?? null);
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setResultModalLoading(false);
                                }
                              }}
                              className="ml-4 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                            >
                              View Results
                            </button>
                          ) : (
                            <Link
                              href={`/student/courses/${courseId}/quizzes/${quiz.id}/take`}
                              className="ml-4 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 inline-block text-center"
                            >
                              Take Quiz
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setResultModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Quiz Result: {resultModalQuizName}</h2>
              <button
                onClick={() => setResultModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {resultModalLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
                </div>
              ) : resultData ? (
                <>
                  <div className="text-center mb-6 p-4 bg-indigo-50 rounded-xl">
                    <p className="text-3xl font-bold text-indigo-600">
                      {resultData.attempt.score} / {resultData.attempt.max_score}
                    </p>
                    <p className="text-gray-600 mt-1">
                      {resultData.attempt.max_score > 0
                        ? Math.round((resultData.attempt.score / resultData.attempt.max_score) * 100)
                        : 0}%
                    </p>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-3">Questions</h3>
                  <ul className="space-y-4">
                    {resultData.answers.map((a, idx) => {
                      const correctDisplay =
                        a.questionType === "multiple_choice" && a.options
                          ? a.options[Number(a.correctAnswer)] ?? String(a.correctAnswer)
                          : typeof a.correctAnswer === "boolean"
                            ? a.correctAnswer
                              ? "True"
                              : "False"
                            : String(a.correctAnswer);
                      const userDisplay =
                        a.questionType === "multiple_choice" && a.options && typeof a.userAnswer === "number"
                          ? a.options[a.userAnswer] ?? String(a.userAnswer)
                          : typeof a.userAnswer === "boolean"
                            ? a.userAnswer
                              ? "True"
                              : "False"
                            : String(a.userAnswer);
                      return (
                        <li
                          key={a.questionId}
                          className={`p-4 rounded-xl border-2 ${
                            a.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                                a.isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"
                              }`}
                            >
                              {a.isCorrect ? "✓" : "✗"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800">
                                {idx + 1}. {a.questionText}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                Your answer: <span className="font-medium">{userDisplay}</span>
                              </p>
                              {!a.isCorrect && (
                                <p className="text-sm text-green-700 mt-0.5">
                                  Correct answer: <span className="font-medium">{correctDisplay}</span>
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

