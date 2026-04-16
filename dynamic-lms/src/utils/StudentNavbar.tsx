"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useStudentCourses } from "@/contexts/StudentCoursesContext";

interface StudentNavbarProps {
  currentPage?: "profile" | "courses" | "dashboard";
  onJoinCourse?: () => void;
}

export default function StudentNavbar({ currentPage = "dashboard", onJoinCourse }: StudentNavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { courses, loading } = useStudentCourses();

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
    <nav className="sticky top-0 z-50 border-b border-rose-100 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo Section */}
          <Link href="/student" className={`flex min-w-0 items-center gap-2 transition-opacity duration-200 ${
            mobileMenuOpen ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}>
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
                href="/student"
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
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  currentPage === "courses" ? "text-red-600 bg-red-50" : "text-gray-700 hover:text-red-600 hover:bg-red-50"
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
                          {courses.map((course) => (
                            <Link 
                                key={course.id} 
                                href={`/student/dashboard/${course.id}/content`} 
                                onClick={() => setCoursesDropdownOpen(false)}
                                className="block p-4 hover:bg-rose-50"
                            >
                              <h4 className="font-semibold text-gray-800 truncate" title={course.name}>{course.name}</h4>
                              <p className="text-sm text-gray-600 truncate" title={course.code}>{course.code}</p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Link
              href="/student/profile"
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                currentPage === "profile" ? "text-red-600 bg-red-50" : "text-gray-700 hover:text-red-600 hover:bg-red-50"
              }`}
            >
              Profile
            </Link>

            <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50">
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

          {/* Hamburger Menu Button (Mobile Only) */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-rose-50 hover:text-red-600 transition-colors"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
        <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 md:hidden transition-opacity duration-300
          ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Right Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 max-w-[80%] z-50 bg-white shadow-2xl border-l border-rose-100 transform transition-transform duration-300 ease-in-out md:hidden
          ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-rose-100">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-9 h-9 rounded-xl shadow-md"
            />
            <span className="text-lg font-bold text-gray-900 truncate">
              LohikAral
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-rose-50 text-gray-900"
          >
            ✕
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          <Link
            href="/student"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:text-red-600 hover:bg-rose-50"
          >
            Dashboard
          </Link>

          <Link
            href="/student/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:text-red-600 hover:bg-rose-50"
          >
            Profile
          </Link>

          <Link
            href="/student/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:text-red-600 hover:bg-rose-50"
          >
            My Courses
          </Link>

          <hr className="border-rose-100" />

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-red-600 hover:bg-rose-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
            </button>
          </div>
        </div>
      </>
    </nav>
  ); 
}