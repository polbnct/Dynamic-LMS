"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { getQuizzes, submitQuizAnswers } from "@/lib/supabase/queries/quizzes";
import type { Question } from "@/lib/supabase/queries/quizzes";

export default function TakeQuizPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const quizId = params.quizId as string;
  const submittedOrNavigatingRef = useRef(false);

  const [course, setCourse] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Track student activity for monitoring
  useEffect(() => {
    if (!attemptId) return;

    let tabCount = 1;
    let isFocused = true;
    let heartbeatInterval: NodeJS.Timeout;

    // Update activity status (define early; used by multiple handlers below)
    const updateActivity = async (status: "online" | "focused" | "blurred" | "tab_count") => {
      try {
        const res = await fetch("/api/quiz-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            status,
            tabCount,
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn("quiz-activity failed:", res.status, text);
          return;
        }
        // Helpful diagnostics when logs are not being persisted (e.g. migration not applied).
        if (status !== "online") {
          const data = (await res.json().catch(() => null)) as any;
          if (data && data.logged === false) {
            console.warn("quiz-activity log not saved:", data.logError || data);
          }
        }
      } catch (err) {
        console.error("Failed to update activity:", err);
      }
    };

    // Track tab visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isFocused = false;
        updateActivity("blurred");
      } else {
        isFocused = true;
        updateActivity("focused");
      }
    };

    // Track window focus/blur
    const handleFocus = () => {
      isFocused = true;
      updateActivity("focused");
    };

    const handleBlur = () => {
      isFocused = false;
      updateActivity("blurred");
    };

    // Track multiple tabs (using BroadcastChannel and localStorage)
    const tabKey = `quiz-tab-${attemptId}`;
    const channel = new BroadcastChannel(`quiz-${attemptId}`);
    
    // Increment tab count on load
    const currentTabs = parseInt(localStorage.getItem(tabKey) || "0", 10);
    const newTabs = currentTabs + 1;
    localStorage.setItem(tabKey, newTabs.toString());
    tabCount = newTabs;

    // Broadcast to other tabs
    channel.postMessage({ type: "tab-count", count: newTabs });
    // Log tab count changes so professor can review multi-tab attempts
    updateActivity("tab_count");

    // Listen for tab count updates from other tabs
    channel.onmessage = (event) => {
      if (event.data.type === "tab-count") {
        tabCount = event.data.count;
        updateActivity("tab_count");
      }
    };

    // Clean up on page unload
    const handleBeforeUnload = () => {
      const tabs = parseInt(localStorage.getItem(tabKey) || "0", 10);
      if (tabs > 0) {
        const updatedTabs = tabs - 1;
        localStorage.setItem(tabKey, updatedTabs.toString());
        channel.postMessage({ type: "tab-count", count: updatedTabs });
      }
    };

    // Heartbeat to keep connection alive (always send; focus state is tracked separately)
    const sendHeartbeat = () => {
      updateActivity("online");
    };

    // Initialize
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    // Send initial status
    updateActivity("online");
    
    // Send heartbeat every 5 seconds
    heartbeatInterval = setInterval(sendHeartbeat, 5000);

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(heartbeatInterval);
      channel.close();
      const tabs = parseInt(localStorage.getItem(tabKey) || "0", 10);
      if (tabs > 0) {
        localStorage.setItem(tabKey, (tabs - 1).toString());
      }
      // Don't send "offline" from client cleanup.
      // Offline should be inferred server-side from missing heartbeats to avoid race conditions (dev strict mode, navigation).
    };
  }, [attemptId]);

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
        const studentId = await getCurrentStudentId();
        if (!studentId) {
          throw new Error("Student not found");
        }

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

      submittedOrNavigatingRef.current = true;
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

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <StudentNavbar currentPage="courses" />
        <StudentCourseNavbar courseId={courseId} currentPage="quizzes" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error || "Quiz not found"}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <StudentNavbar currentPage="courses" />
      <StudentCourseNavbar courseId={courseId} currentPage="quizzes" courseName={course?.name} courseCode={course?.code} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header with timer */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              {quiz.name}
            </h1>
            <p className="text-gray-600">{questions.length} questions</p>
          </div>
          {timeRemaining !== null && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Time Remaining</div>
              <div className={`text-2xl font-bold ${timeRemaining < 300 ? "text-red-600" : "text-indigo-600"}`}>
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
                <span className="text-sm font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
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
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-indigo-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={optIndex}
                        checked={answers[question.id] === optIndex}
                        onChange={() => handleAnswerChange(question.id, optIndex)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span>{option}</span>
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {submitting ? "Submitting..." : "Submit Quiz"}
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

