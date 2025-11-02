"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById } from "@/lib/mockData/courses";

// Lesson interface with category and PDF
interface Lesson {
  id: string;
  title: string;
  description?: string;
  category: "prelim" | "midterm" | "finals";
  pdfUrl?: string;
  pdfFileName?: string;
  order: number;
  createdAt: string;
}

// Mock lessons data with categories
const MOCK_LESSONS: Lesson[] = [
  {
    id: "1",
    title: "Introduction to Discrete Structures",
    description: "Overview of discrete mathematics, sets, and basic operations",
    category: "prelim",
    pdfFileName: "Introduction.pdf",
    order: 1,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "2",
    title: "Propositional Logic",
    description: "Understanding logical statements, truth tables, and logical operators",
    category: "prelim",
    pdfFileName: "Propositional_Logic.pdf",
    order: 2,
    createdAt: "2024-01-20T10:00:00Z",
  },
  {
    id: "3",
    title: "Set Theory Basics",
    description: "Introduction to sets, subsets, unions, intersections, and complements",
    category: "midterm",
    pdfFileName: "Set_Theory.pdf",
    order: 1,
    createdAt: "2024-01-25T10:00:00Z",
  },
  {
    id: "4",
    title: "Relations and Functions",
    description: "Understanding binary relations, equivalence relations, and functions",
    category: "finals",
    pdfFileName: "Relations_Functions.pdf",
    order: 1,
    createdAt: "2024-02-01T10:00:00Z",
  },
];

export default function StudentContentPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [studyAidModalOpen, setStudyAidModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [studyAidType, setStudyAidType] = useState<"flashcards" | "fill_blank" | "multiple_choice">("flashcards");

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        // In real implementation, fetch lessons from API
        setLessons(MOCK_LESSONS);
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

  const handleStudyAid = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setStudyAidModalOpen(true);
    setStudyAidType("flashcards");
  };

  // Group lessons by category
  const lessonsByCategory = {
    prelim: lessons.filter((l) => l.category === "prelim"),
    midterm: lessons.filter((l) => l.category === "midterm"),
    finals: lessons.filter((l) => l.category === "finals"),
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
        <StudentCourseNavbar courseId={courseId} currentPage="content" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalLessons = lessons.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Main Student Navbar */}
      <StudentNavbar currentPage="courses" />
      
      {/* Student Course Navbar */}
      <StudentCourseNavbar
        courseId={courseId}
        currentPage="content"
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
              Course Content
            </h1>
            <p className="text-gray-600">
              {course?.name} ({course?.code}) • {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Lessons by Category */}
        {totalLessons === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No lessons available</h3>
              <p className="text-gray-600">Lessons will appear here when your professor adds them</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {(["prelim", "midterm", "finals"] as const).map((category) => {
              const categoryLessons = lessonsByCategory[category];
              if (categoryLessons.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                      {categoryLessons.length} lesson{categoryLessons.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Lessons List */}
                  <div className="space-y-4">
                    {categoryLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{lesson.title}</h3>
                            {lesson.description && (
                              <p className="text-gray-600 mb-4">{lesson.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-4">
                              {lesson.pdfFileName && (
                                <div className="flex items-center gap-2 text-indigo-600">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <span className="text-sm font-medium">{lesson.pdfFileName}</span>
                                </div>
                              )}
                              <button
                                onClick={() => handleStudyAid(lesson)}
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-sm"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                                  />
                                </svg>
                                Study Aid
                              </button>
                            </div>
                          </div>
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

      {/* Study Aid Modal */}
      {studyAidModalOpen && selectedLesson && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setStudyAidModalOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Study Aid: {selectedLesson.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">Choose a study method</p>
              </div>
              <button
                onClick={() => setStudyAidModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Study Aid Type Selection */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-4">
                <button
                  onClick={() => setStudyAidType("flashcards")}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    studyAidType === "flashcards"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform -translate-y-0.5"
                      : "bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    Flashcards
                  </div>
                </button>
                <button
                  onClick={() => setStudyAidType("fill_blank")}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    studyAidType === "fill_blank"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform -translate-y-0.5"
                      : "bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Fill in the Blank
                  </div>
                </button>
                <button
                  onClick={() => setStudyAidType("multiple_choice")}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    studyAidType === "multiple_choice"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform -translate-y-0.5"
                      : "bg-white text-gray-700 border border-gray-300 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Multiple Choice
                  </div>
                </button>
              </div>
            </div>

            {/* Study Aid Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {studyAidType === "flashcards" && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                    <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">Flashcards</h3>
                  <p className="text-gray-600 mb-8">Flashcard study mode for {selectedLesson.title}</p>
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 max-w-md mx-auto">
                    <p className="text-gray-500 text-sm mb-4">Click to flip</p>
                    <div className="bg-white rounded-xl shadow-lg p-8 min-h-[200px] flex items-center justify-center">
                      <p className="text-lg font-semibold text-gray-700">Flashcard content will appear here</p>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-6">
                      <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">1 / 10</span>
                      <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {studyAidType === "fill_blank" && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                    <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">Fill in the Blank</h3>
                  <p className="text-gray-600 mb-8">Practice with fill-in-the-blank questions</p>
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 max-w-2xl mx-auto space-y-4">
                    <div className="bg-white rounded-xl shadow-lg p-6 text-left">
                      <p className="text-gray-700 mb-4">
                        A <span className="inline-block w-32 h-8 border-b-2 border-indigo-600 bg-indigo-50 rounded px-2"></span> is a collection of distinct objects.
                      </p>
                      <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                        Check Answer
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">Question 1 of 5</p>
                  </div>
                </div>
              )}

              {studyAidType === "multiple_choice" && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                    <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">Multiple Choice</h3>
                  <p className="text-gray-600 mb-8">Test your knowledge with multiple choice questions</p>
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 max-w-2xl mx-auto space-y-4">
                    <div className="bg-white rounded-xl shadow-lg p-6 text-left">
                      <p className="text-lg font-semibold text-gray-800 mb-4">What is a set in discrete mathematics?</p>
                      <div className="space-y-3">
                        {["A collection of distinct objects", "A mathematical function", "A type of relation", "A graph structure"].map((option, idx) => (
                          <button
                            key={idx}
                            className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                          >
                            <span className="font-medium text-gray-700">{String.fromCharCode(65 + idx)}. {option}</span>
                          </button>
                        ))}
                      </div>
                      <button className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                        Check Answer
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">Question 1 of 5</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <button
                onClick={() => setStudyAidModalOpen(false)}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
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

