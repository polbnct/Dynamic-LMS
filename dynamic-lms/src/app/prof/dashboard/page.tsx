"use client";

import React, { useState } from "react";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";

export default function ProfessorDashboard() {
  const { courses, handledCourses, loading, error: contextError, refetch } = useProfessorCourses();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const combinedError = error || contextError || "";
  const [search, setSearch] = useState("");
  const isSearching = search.trim().length > 0;

  const filteredCourses = React.useMemo(() => {
    const filtered = courses.filter((c) =>
    (c.name + " " + c.code).toLowerCase().includes(search.toLowerCase())
    );

  const lastAccessed = localStorage.getItem("lastAccessedCourse");
  if (!lastAccessed) return filtered;

  return [...filtered].sort((a, b) => {
    if (a.id === lastAccessed) return -1;
    if (b.id === lastAccessed) return 1;
    return 0;
  });
  }, [courses, search]);
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
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
            Welcome Back, Professor!
          </h1>
            <p className="text-gray-600">Manage your courses and students</p>
        </div>
            <div className="w-full sm:w-96 flex items-center rounded-2xl border border-red-200 bg-white px-3 py-2 shadow-sm focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-100 transition">
              <svg
                className="h-5 w-5 text-gray-400 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              <input
                type="text"
                placeholder="Search by course name or code"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-700 outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {isSearching && (
                 <button
                    onClick={() => setSearch("")}
                    className="ml-2 shrink-0 border-l border-red-100 pl-3 text-sm font-medium text-red-600 hover:text-red-700 transition"
                    > 
                      Clear
                    </button> 
                )}
              </div>
            </div>
              {combinedError && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {combinedError}
                </div>
              )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        )}

        {/* Course Cards Grid */}
        {!loading && (
          <>
            {filteredCourses.length === 0 ? (
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
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isSearching ? "No results found" : "No courses yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {isSearching
                    ? "Try a different keyword."
                    : "Courses are created and managed by your admin. Please contact the admin to create a course for you."}
                </p>
              </div>
            ) : (
          <div className="bg-white/80 border border-gray-300 rounded-2xl shadow-sm p-5">
            <div className="max-h-[405px] overflow-y-auto pr-3 pb-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="group min-w-0 overflow-hidden bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all duration-200"
                  >
                    <Link href={`/prof/courses/${course.id}/content`} className="block min-w-0"
                    onClick={() => {
                      localStorage.setItem("lastAccessedCourse", course.id);
                    }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-md font-bold text-gray-800 group-hover:text-red-600 transition-colors truncate flex-1" 
                        title={course.name}
                        >
                          {course.name}
                        </h3>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-8 h-8 text-gray-700 shrink-0 hidden md:block"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6.253v11.494m0-11.494C10.832 5.477 9.246 5 7.5 5A3.5 3.5 0 004 8.5v9A3.5 3.5 0 017.5 14c1.746 0 3.332.477 4.5 1.253m0-9C13.168 5.477 14.754 5 16.5 5A3.5 3.5 0 0120 8.5v9A3.5 3.5 0 0016.5 14c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 truncate">{course.code}</p>
                      <div className="mt-4 grid grid-cols-4 border border-gray-200 rounded-xl overflow-hidden divide-x divide-gray-200">
                        <div className="py-3 text-center">
                          <div className="text-sm font-semibold text-gray-900">{course.studentsCount || 0}</div>
                          <div className="text-xs text-gray-500 truncate">Students</div>
                        </div>

                        <div className="py-3 text-center">
                          <div className="text-sm font-semibold text-gray-900">{course.lessonsCount || 0}</div>
                          <div className="text-xs text-gray-500 truncate">Lessons</div>
                        </div>

                        <div className="py-3 text-center">
                          <div className="text-sm font-semibold text-gray-900">{course.assignmentsCount || 0}</div>
                          <div className="text-xs text-gray-500 truncate">Assignments</div>
                        </div>

                        <div className="py-3 text-center">
                          <div className="text-sm font-semibold text-gray-900">{course.quizzesCount || 0}</div>
                          <div className="text-xs text-gray-500 truncate">Quizzes</div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    )}
      </main>
    </div>
  );
}
