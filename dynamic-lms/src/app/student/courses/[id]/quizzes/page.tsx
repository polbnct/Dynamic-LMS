"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById } from "@/lib/mockData/courses";

// Quiz interface
interface Quiz {
  id: string;
  title: string;
  description?: string;
  category: "prelim" | "midterm" | "finals";
  createdAt: string;
  dueDate?: string;
  timeLimit?: number; // in minutes
  questionsCount?: number;
  taken?: boolean;
  score?: number;
  maxScore?: number;
}

// Mock quizzes data
const MOCK_QUIZZES: Quiz[] = [
  {
    id: "1",
    title: "Prelim Quiz 1: Sets and Logic",
    description: "Test your knowledge on sets and propositional logic",
    category: "prelim",
    createdAt: "2024-01-20T10:00:00Z",
    dueDate: "2024-02-05T23:59:00Z",
    timeLimit: 30,
    questionsCount: 10,
    taken: true,
    score: 85,
    maxScore: 100,
  },
  {
    id: "2",
    title: "Prelim Quiz 2: Logical Operations",
    description: "Quiz on logical operators and truth tables",
    category: "prelim",
    createdAt: "2024-01-25T10:00:00Z",
    dueDate: "2024-02-10T23:59:00Z",
    timeLimit: 25,
    questionsCount: 8,
    taken: false,
  },
  {
    id: "3",
    title: "Midterm Quiz: Functions and Relations",
    description: "Comprehensive quiz on functions and relations",
    category: "midterm",
    createdAt: "2024-02-01T10:00:00Z",
    dueDate: "2024-02-20T23:59:00Z",
    timeLimit: 45,
    questionsCount: 15,
    taken: false,
  },
];

export default function StudentQuizzesPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        // In real implementation, fetch quizzes from API
        setQuizzes(MOCK_QUIZZES);
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
                              {quiz.taken && quiz.score !== undefined && quiz.maxScore !== undefined && (
                                <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span>Score: {quiz.score}/{quiz.maxScore} ({(quiz.score / quiz.maxScore * 100).toFixed(0)}%)</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button className="ml-4 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200">
                            {quiz.taken ? "View Results" : "Take Quiz"}
                          </button>
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
    </div>
  );
}

