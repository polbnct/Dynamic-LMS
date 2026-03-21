"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getStudentCourses, getCurrentStudentId, type CourseWithStudents } from "@/lib/supabase/queries/courses.client";

interface StudentNavbarProps {
  currentPage?: "profile" | "courses" | "dashboard";
  onJoinCourse?: () => void;
}

export default function StudentNavbar({ currentPage = "dashboard", onJoinCourse }: StudentNavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseWithStudents[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    async function fetchCourses() {
      try {
        const studentId = await getCurrentStudentId();
        if (!studentId) {
          setLoading(false);
          return;
        }
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
    <nav className="sticky top-0 z-50 border-b border-rose-100 bg-white/85 shadow-sm backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo Section */}
          <Link href="/student/dashboard" className="flex min-w-0 items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 via-rose-500 to-orange-400 shadow-lg shadow-red-200">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="hidden sm:inline text-xl font-bold text-gray-900 truncate">
              Dynamic LMS
            </span>
          </Link>

          {/* Desktop Nav Items (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            <Link
              href="/student/profile"
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                currentPage === "profile" ? "text-red-600" : "text-gray-700 hover:text-red-600"
              }`}
            >
              Profile
            </Link>

            {/* Courses Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCoursesDropdownOpen(!coursesDropdownOpen)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  currentPage === "courses" ? "text-red-600" : "text-gray-700 hover:text-red-600"
                }`}
              >
                <span>Courses</span>
                <svg className={`w-4 h-4 transition-transform ${coursesDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {coursesDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCoursesDropdownOpen(false)}></div>
                  <div className="absolute right-0 z-50 mt-2 w-[90vw] max-w-sm sm:max-w-md overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-2xl">
                    <div className="border-b border-rose-100 bg-gradient-to-r from-rose-50 to-red-50 p-4">
                      <h3 className="font-bold text-lg text-gray-900">My Courses</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {loading ? (
                        <div className="p-8 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-red-500"></div></div>
                      ) : (
                        <div className="divide-y divide-rose-50">
                          {enrolledCourses.map((course) => (
                            <Link 
                                key={course.id} 
                                href={`/student/dashboard/${course.id}/content`} 
                                onClick={() => setCoursesDropdownOpen(false)}
                                className="block p-4 hover:bg-rose-50"
                            >
                              <h4 className="font-semibold text-gray-800">{course.name}</h4>
                              <p className="text-sm text-gray-600">{course.code}</p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition-colors">
              Logout
            </button>
          </div>

          {/* Hamburger Menu Button (Mobile Only) */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-rose-50 hover:text-red-600 transition-colors"
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

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-rose-100 bg-white p-4 space-y-2 shadow-inner">
          <Link
            href="/student/profile"
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:text-red-600"
            onClick={() => setMobileMenuOpen(false)}
          >
            Profile
          </Link>
          <Link
            href="/student/dashboard"
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:text-red-600"
            onClick={() => setMobileMenuOpen(false)}
          >
            My Courses
          </Link>
          <hr className="border-rose-100" />
          <button
            onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-red-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}