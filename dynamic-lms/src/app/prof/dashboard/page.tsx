"use client";

import React, { useState } from "react";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import type { CourseWithStudents } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";

export default function ProfessorDashboard() {
  const { courses, handledCourses, loading, error: contextError, refetch } = useProfessorCourses();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const combinedError = error || contextError || "";
  useSyncMessagesToToast(combinedError, success);
  // Professors can no longer edit or delete courses; this is admin-only now.

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      {/* Professor Navbar - same courses as dashboard, create works from anywhere */}
      <ProfessorNavbar
        currentPage="dashboard"
        handledCourses={handledCourses}
      />
    
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">

        {/* Top Banner Image */}
        <div className="w-full mb-8">
          <div className="w-full h-40 sm:h-52 md:h-60 lg:h-72 overflow-hidden rounded-3xl shadow-xl">
            <img
              src="/dashboard_image.svg"
              alt="Dashboard Banner"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Welcome Back, Professor!
          </h1>
          <p className="text-gray-600">Manage your courses and students</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        )}

        {/* Course Cards Grid */}
        {!loading && (
          <>
            {courses.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-red-100 to-rose-100 rounded-full mb-4">
                  <svg
                    className="w-12 h-12 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No courses yet</h3>
                <p className="text-gray-600 mb-6">
                  Courses are created and managed by your admin. Please contact the admin to create a course for you.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="group min-w-0 overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                  >
                    <Link href={`/prof/courses/${course.id}/content`} className="block min-w-0">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-800 group-hover:text-red-600 transition-colors truncate" 
                          title={course.name}
                          >
                            {course.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 truncate">{course.code}</p>
                        </div>
                        <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-rose-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg
                            className="w-8 h-8 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-4 border border-gray-200 rounded-xl overflow-hidden divide-x divide-gray-200">
                        <div className="py-3 text-center">
                          <div className="text-sm font-semibold text-gray-900">{course.studentsCount || 0}</div>
                          <div className="text-xs text-gray-500">Students</div>
                        </div>

                        <div className="py-3 text-center">
                          <div className="text-sm font-semibold text-gray-900">{course.lessonsCount || 0}</div>
                          <div className="text-xs text-gray-500">Lessons</div>
                        </div>

                        <div className="py-3 text-center">
                          <div className="text-sm font-semibold text-gray-900">{course.assignmentsCount || 0}</div>
                          <div className="text-xs text-gray-500">Assignments</div>
                        </div>

                        <div className="py-3 text-center">
                          <div className="text-sm font-semibold text-gray-900">{course.quizzesCount || 0}</div>
                          <div className="text-xs text-gray-500">Quizzes</div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Professors can no longer edit or delete courses here; course management is admin-only. */}
      </main>
    </div>
  );
}
