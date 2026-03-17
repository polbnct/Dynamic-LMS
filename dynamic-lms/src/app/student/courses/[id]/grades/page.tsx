"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { getStudentGrades } from "@/lib/supabase/queries/grades";
import type { Grade } from "@/lib/supabase/queries/grades";

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
        
        const studentId = await getCurrentStudentId();
        if (!studentId) {
          throw new Error("Student not found");
        }

        const gradesData = await getStudentGrades(courseId, studentId);
        setGrades(Array.isArray(gradesData) ? gradesData : []);
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

  // Group grades by category, then by underlying assessment (assignment/quiz)
  type GradeItem = {
    itemId: string;
    title: string;
    type: Grade["type"];
    category: Grade["category"];
    attempts: Grade[];
  };

  const groupByItem = (items: Grade[]): GradeItem[] => {
    const map = new Map<string, GradeItem>();
    for (const g of items) {
      const key = `${g.type}:${g.itemId}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          itemId: g.itemId,
          title: g.title,
          type: g.type,
          category: g.category,
          attempts: [g],
        });
      } else {
        existing.attempts.push(g);
      }
    }

    // Sort attempts by submittedAt/gradedAt ascending
    for (const item of map.values()) {
      item.attempts.sort((a, b) => {
        const aDate = a.submittedAt || a.gradedAt || "";
        const bDate = b.submittedAt || b.gradedAt || "";
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
    }

    return Array.from(map.values());
  };

  const gradesByCategory = {
    prelim: groupByItem(grades.filter((g) => g.category === "prelim")),
    midterm: groupByItem(grades.filter((g) => g.category === "midterm")),
    finals: groupByItem(grades.filter((g) => g.category === "finals")),
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
            href="/student/dashboard"
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
                {course?.name} ({course?.code}) • {totalGrades} attempt{totalGrades !== 1 ? "s" : ""}
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
              const categoryItems = gradesByCategory[category];
              if (categoryItems.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                      {categoryItems.length} item{categoryItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Grades List */}
                  <div className="space-y-4">
                    {categoryItems.map((item) => (
                      <div
                        key={item.itemId}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-xl font-bold text-gray-800">{item.title}</h3>
                              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                                {typeLabels[item.type]}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {item.attempts.length} attempt{item.attempts.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>

                        {/* Attempts list */}
                        <div className="space-y-2 mt-2">
                          {item.attempts.map((attempt, idx) => (
                            <div
                              key={attempt.id}
                              className="py-2 px-3 rounded-xl bg-gray-50 border border-gray-100"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                                    #{idx + 1}
                                  </span>
                                  <div className="flex flex-col">
                                    {attempt.submittedAt && (
                                      <span className="text-xs text-gray-600">
                                        Submitted:{" "}
                                        {new Date(attempt.submittedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                    {attempt.gradedAt && (
                                      <span className="text-xs text-gray-500">
                                        Graded: {new Date(attempt.gradedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-700">
                                    {attempt.score}/{attempt.maxScore}
                                  </span>
                                  <span className="text-sm font-semibold text-indigo-600">
                                    {attempt.percentage.toFixed(0)}%
                                  </span>
                                </div>
                              </div>

                              {attempt.feedback && attempt.feedback.trim() && (
                                <div className="mt-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm text-gray-700">
                                  <div className="text-xs font-semibold text-indigo-700 mb-1">Feedback</div>
                                  <div className="whitespace-pre-wrap">{attempt.feedback}</div>
                                </div>
                              )}
                            </div>
                          ))}
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

