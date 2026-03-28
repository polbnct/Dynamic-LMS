"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface HandledCourse {
  id: string;
  name: string;
  code: string;
  studentsCount?: number;
}

interface ProfessorNavbarProps {
  currentPage?: "profile" | "courses" | "dashboard";
  handledCourses?: HandledCourse[];
}

export default function ProfessorNavbar({
  currentPage,
  handledCourses = [],
}: ProfessorNavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
        alert("Failed to logout. Please try again.");
      } else {
        router.push("/login");
      }
    } catch (err) {
      console.error("Logout error:", err);
      alert("Failed to logout. Please try again.");
    }
  };

  return (
    <>
      {/* Modern Navbar */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo */}
            <Link href="/student" className="flex min-w-0 items-center gap-2">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-10 h-10 rounded-xl shadow-lg"
              />
              <span className="hidden sm:inline text-xl font-bold text-gray-900 truncate">
                LohikAral
              </span>
            </Link>

            {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center gap-2 lg:gap-4">
              {/* Dashboard */}
              <Link
                href="/prof"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  currentPage === "dashboard"
                    ? "text-red-600 bg-red-50"
                    : "text-gray-700 hover:text-red-600 hover:bg-red-50"
                }`}
              >
                Dashboard
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
                    <div className="absolute right-0 mt-2 w-[90vw] max-w-sm sm:max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-rose-50">
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
                                className="block p-4 hover:bg-red-50 transition-colors"
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
                                    <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-rose-100 rounded-lg flex items-center justify-center">
                                      <svg
                                        className="w-6 h-6 text-red-600"
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
                        <div className="text-xs text-gray-500 text-center">
                          Course creation is managed by an admin.
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Profile */}
              <Link
                href="/prof/profile"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  currentPage === "profile"
                    ? "text-red-600 bg-red-50"
                    : "text-gray-700 hover:text-red-600 hover:bg-red-50"
                }`}
              >
                Profile
              </Link>

              {/* Logout */}
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Logout
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="p-2 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white p-4 space-y-2 shadow-inner">
          <Link
            href="/prof"
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600"
            onClick={() => setMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/prof/profile"
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600"
            onClick={() => setMobileMenuOpen(false)}
          >
            Profile
          </Link>
          <Link
            href="/prof/courses"
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600"
            onClick={() => setMobileMenuOpen(false)}
          >
            Courses
          </Link>
          <hr className="border-gray-200" />
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-red-600 hover:bg-red-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      )}

      {/* Course creation is admin-managed (no professor modal). */}
    </>
  );
}

