"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getStudentCourses, getCurrentStudentId, CourseWithStudents } from "@/lib/mockData/courses";

interface StudentNavbarProps {
  currentPage?: "profile" | "courses" | "dashboard";
  onJoinCourse?: () => void;
}

export default function StudentNavbar({ currentPage = "dashboard", onJoinCourse }: StudentNavbarProps) {
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseWithStudents[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const studentId = getCurrentStudentId();
        const courses = await getStudentCourses(studentId);
        setEnrolledCourses(courses);
      } catch (err) {
        console.error("Error fetching courses:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  return (
    <nav className="bg-white/85 backdrop-blur-sm border-b border-rose-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/student/courses" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 via-rose-500 to-orange-400 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
              <svg
                className="w-6 h-6 text-white"
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
            <span className="text-xl font-bold bg-gradient-to-r from-red-700 via-rose-600 to-red-500 bg-clip-text text-transparent">
              Dynamic LMS
            </span>
          </Link>

          {/* Nav Items */}
          <div className="flex items-center gap-4">
            {/* Profile */}
            <Link
              href="/student/profile"
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                currentPage === "profile"
                  ? "text-red-600 bg-red-50"
                  : "text-gray-700 hover:text-red-600 hover:bg-red-50"
              }`}
            >
              Profile
            </Link>

            {/* Courses Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCoursesDropdownOpen(!coursesDropdownOpen)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  currentPage === "courses"
                    ? "text-red-600 bg-red-50"
                    : "text-gray-700 hover:text-red-600 hover:bg-red-50"
                }`}
              >
                <span>Courses</span>
                <svg
                  className={`w-4 h-4 transition-transform ${coursesDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Modal */}
              {coursesDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCoursesDropdownOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-rose-100 z-50 overflow-hidden">
                    <div className="p-4 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-red-50">
                      <h3 className="font-bold text-lg text-gray-900">My Courses</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {loading ? "Loading..." : `${enrolledCourses.length} enrolled course${enrolledCourses.length !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {loading ? (
                        <div className="p-8 text-center text-gray-500">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                        </div>
                      ) : enrolledCourses.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <p>No enrolled courses yet.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-rose-50">
                          {enrolledCourses.map((course) => {
                            // Calculate progress (mock - replace with real calculation)
                            const progress = Math.floor(Math.random() * 40) + 50;
                            
                            return (
                              <Link
                                key={course.id}
                                href={`/student/courses/${course.id}/content`}
                                onClick={() => setCoursesDropdownOpen(false)}
                                className="block p-4 hover:bg-rose-50 transition-colors"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-800">{course.name}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{course.code}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {course.professorName}
                                    </p>
                                  </div>
                                  <div className="ml-4">
                                    <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-rose-100 bg-rose-50">
                      <Link
                        href="/student/courses"
                        onClick={() => setCoursesDropdownOpen(false)}
                        className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white py-2.5 px-4 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        View All Courses
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Logout */}
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

