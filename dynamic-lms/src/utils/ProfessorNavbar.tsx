"use client";

import React, { useState } from "react";
import Link from "next/link";

interface HandledCourse {
  id: number;
  name: string;
  code: string;
  studentsCount?: number;
}

interface ProfessorNavbarProps {
  currentPage?: "profile" | "courses" | "dashboard";
  onCreateCourse?: (courseName: string) => void;
  handledCourses?: HandledCourse[];
}

export default function ProfessorNavbar({
  currentPage,
  onCreateCourse,
  handledCourses = [],
}: ProfessorNavbarProps) {
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  const [createCourseModalOpen, setCreateCourseModalOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [error, setError] = useState("");

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!courseName.trim()) {
      setError("Please enter a course name.");
      return;
    }

    // Call the parent's onCreateCourse handler
    if (onCreateCourse) {
      onCreateCourse(courseName.trim());
    } else {
      // Fallback if no handler provided
      alert(`Creating course: ${courseName.trim()}`);
    }

    setCourseName("");
    setCreateCourseModalOpen(false);
  };

  return (
    <>
      {/* Modern Navbar */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/prof" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
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
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Dynamic LMS
              </span>
            </Link>

            {/* Nav Items */}
            <div className="flex items-center gap-4">
              {/* Profile */}
              <Link
                href="/prof/profile"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  currentPage === "profile"
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
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
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
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
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                        <h3 className="font-bold text-lg text-gray-800">Handled Courses</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {handledCourses.length} course{handledCourses.length !== 1 ? "s" : ""} you manage
                        </p>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {handledCourses.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <p>No courses yet. Create your first course!</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {handledCourses.map((course) => (
                              <Link
                                key={course.id}
                                href={`/prof/courses/${course.id}`}
                                onClick={() => setCoursesDropdownOpen(false)}
                                className="block p-4 hover:bg-indigo-50 transition-colors"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-800">{course.name}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{course.code}</p>
                                    {course.studentsCount !== undefined && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        {course.studentsCount} student{course.studentsCount !== 1 ? "s" : ""}
                                      </p>
                                    )}
                                  </div>
                                  <div className="ml-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center">
                                      <svg
                                        className="w-6 h-6 text-indigo-600"
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
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="p-4 border-t border-gray-200 bg-gray-50">
                        <button
                          onClick={() => {
                            setCoursesDropdownOpen(false);
                            setCreateCourseModalOpen(true);
                          }}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
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
                          Create Course
                        </button>
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

      {/* Create Course Modal */}
      {createCourseModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setCreateCourseModalOpen(false);
              setCourseName("");
              setError("");
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Create New Course
                </h2>
                <button
                  onClick={() => {
                    setCreateCourseModalOpen(false);
                    setCourseName("");
                    setError("");
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label
                    htmlFor="courseName"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Course Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
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
                    <input
                      id="courseName"
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="Enter course name"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                      autoFocus
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Enter the name of the course you want to create
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-red-600 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateCourseModalOpen(false);
                      setCourseName("");
                      setError("");
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Create Course
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}

