"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { getQuizzes, submitQuizAnswers } from "@/lib/supabase/queries/quizzes";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";
import type { Question } from "@/lib/supabase/queries/quizzes";

export default function TakeQuizPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const quizId = params.quizId as string;

  const [course, setCourse] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");

  useSyncMessagesToToast(error, "");

  // Lightweight activity logging: track when the quiz tab gains/loses focus (alt-tab / tab switch)
  // ONLY while the student is actually on the quiz-taking page with questions loaded.
  // We rely solely on document.visibilitychange to avoid duplicate events from window focus/blur.
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

    // Initial state: assume focused when the attempt starts.
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

        // Start quiz attempt
        const res = await fetch("/api/quizzes/start-attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null) as any;
          throw new Error(data?.error || "Failed to start quiz attempt");
        }
        const data = await res.json() as any;
        const attempt = data?.attempt;
        if (!attempt?.id) throw new Error("Quiz attempt not found");
        setAttemptId(attempt.id);

        // Set timer if time limit exists
        if (foundQuiz.time_limit) {
          setTimeRemaining(foundQuiz.time_limit * 60); // Convert to seconds
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

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          // Auto-submit when time runs out
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const handleAnswerChange = (questionId: string, answer: string | number | boolean) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleSubmitQuiz = async () => {
    if (!attemptId) {
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

      await submitQuizAnswers(attemptId, answerArray);
      router.push(`/student/dashboard/${courseId}/quizzes`);
    } catch (err: any) {
      console.error("Error submitting quiz:", err);
      setError(err.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
        <StudentNavbar currentPage="courses" />
        <StudentCourseNavbar courseId={courseId} currentPage="quizzes" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-700">
            <p className="mb-4">This quiz is unavailable.</p>
            <Link href={`/student/dashboard/${courseId}/quizzes`} className="font-semibold text-red-600 hover:underline">
              Back to quizzes
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      <StudentNavbar currentPage="courses" />
      <StudentCourseNavbar courseId={courseId} currentPage="quizzes" courseName={course?.name} courseCode={course?.code} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header with timer */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {quiz.name}
            </h1>
            <p className="text-gray-600">{questions.length} questions</p>
          </div>
          {timeRemaining !== null && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Time Remaining</div>
              <div className={`text-2xl font-bold ${timeRemaining < 300 ? "text-red-600" : "text-red-600"}`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="mb-4">
                <span className="text-sm font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                  Question {index + 1}
                </span>
                <span className="ml-3 text-sm text-gray-500">{question.type.replace("_", " ")}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{question.question}</h3>

              {question.type === "multiple_choice" && Array.isArray(question.options) && question.options.length > 0 && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <label
                      key={optIndex}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-red-50 cursor-pointer text-gray-800"
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={optIndex}
                        checked={answers[question.id] === optIndex}
                        onChange={() => handleAnswerChange(question.id, optIndex)}
                        className="w-4 h-4 text-red-600"
                      />
                      <span className="text-gray-800">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === "true_false" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAnswerChange(question.id, true)}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                      answers[question.id] === true
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    True
                  </button>
                  <button
                    onClick={() => handleAnswerChange(question.id, false)}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                      answers[question.id] === false
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    False
                  </button>
                </div>
              )}

              {question.type === "fill_blank" && (
                <input
                  type="text"
                  value={(answers[question.id] as string) || ""}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Enter your answer"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 placeholder-text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              )}
            </div>
          ))}
        </div>

        {/* Submit button */}
        <div className="mt-8 flex gap-4">
          <Link
            href={`/student/dashboard/${courseId}/quizzes`}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmitQuiz}
            disabled={submitting || Object.keys(answers).length === 0}
            className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {submitting ? "Submitting..." : "Submit Quiz"}
          </button>
        </div>

      </main>
    </div>
  );
}

