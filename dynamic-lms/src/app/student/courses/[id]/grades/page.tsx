"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById } from "@/lib/mockData/courses";

// Grade interface
interface Grade {
  id: string;
  type: "assignment" | "quiz" | "exam";
  title: string;
  category: "prelim" | "midterm" | "finals";
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt?: string;
  gradedAt?: string;
}

// Mock grades data
const MOCK_GRADES: Grade[] = [
  {
    id: "1",
    type: "assignment",
    title: "Set Theory Exercise",
    category: "prelim",
    score: 18,
    maxScore: 20,
    percentage: 90,
    submittedAt: "2024-02-03T14:30:00Z",
    gradedAt: "2024-02-04T10:00:00Z",
  },
  {
    id: "2",
    type: "quiz",
    title: "Prelim Quiz 1: Sets and Logic",
    category: "prelim",
    score: 85,
    maxScore: 100,
    percentage: 85,
    submittedAt: "2024-02-01T15:00:00Z",
    gradedAt: "2024-02-01T15:30:00Z",
  },
  {
    id: "3",
    type: "assignment",
    title: "Logic Problems",
    category: "prelim",
    score: 0,
    maxScore: 25,
    percentage: 0,
  },
];

export default function StudentGradesPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        // In real implementation, fetch grades from API
        setGrades(MOCK_GRADES);
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

  // Calculate category averages
  const calculateCategoryAverage = (category: "prelim" | "midterm" | "finals") => {
    const categoryGrades = grades.filter((g) => g.category === category && g.score > 0);
    if (categoryGrades.length === 0) return null;
    const totalPercentage = categoryGrades.reduce((sum, g) => sum + g.percentage, 0);
    return totalPercentage / categoryGrades.length;
  };

  // Group grades by category
  const gradesByCategory = {
    prelim: grades.filter((g) => g.category === "prelim"),
    midterm: grades.filter((g) => g.category === "midterm"),
    finals: grades.filter((g) => g.category === "finals"),
  };

  const categoryLabels = {
    prelim: "Prelim",
    midterm: "Midterm",
    finals: "Finals",
  };

  const typeLabels = {
    assignment: "Assignment",
    quiz: "Quiz",
    exam: "Exam",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <StudentNavbar currentPage="courses" />
        <StudentCourseNavbar courseId={courseId} currentPage="grades" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalGrades = grades.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Main Student Navbar */}
      <StudentNavbar currentPage="courses" />
      
      {/* Student Course Navbar */}
      <StudentCourseNavbar
        courseId={courseId}
        currentPage="grades"
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
              Grades
            </h1>
            <p className="text-gray-600">
              {course?.name} ({course?.code}) • {totalGrades} grade{totalGrades !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Grades by Category */}
        {totalGrades === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No grades available</h3>
              <p className="text-gray-600">Grades will appear here after your submissions are graded</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {(["prelim", "midterm", "finals"] as const).map((category) => {
              const categoryGrades = gradesByCategory[category];
              if (categoryGrades.length === 0) return null;

              const categoryAverage = calculateCategoryAverage(category);

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                        {categoryGrades.length} item{categoryGrades.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {categoryAverage !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Category Average:</span>
                        <span className="text-xl font-bold text-indigo-600">{categoryAverage.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>

                  {/* Grades List */}
                  <div className="space-y-4">
                    {categoryGrades.map((grade) => (
                      <div
                        key={grade.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-800">{grade.title}</h3>
                              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                                {typeLabels[grade.type]}
                              </span>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-gray-600 mb-2">
                              {grade.submittedAt && (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  <span>Submitted: {new Date(grade.submittedAt).toLocaleDateString()}</span>
                                </div>
                              )}
                              {grade.gradedAt && (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span>Graded: {new Date(grade.gradedAt).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-4">
                              <div className="flex items-center gap-2">
                                <span className="text-3xl font-bold text-indigo-600">{grade.percentage.toFixed(0)}%</span>
                                <span className="text-gray-600">
                                  ({grade.score}/{grade.maxScore})
                                </span>
                              </div>
                              {grade.score === 0 && (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                                  Not Submitted
                                </span>
                              )}
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
    </div>
  );
}

