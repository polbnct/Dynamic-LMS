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
    <nav className="bg-white border-b border-red-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link href="/student/dashboard" className="flex items-center">
            <span className="text-xl font-bold text-red-700">
              LohikAral
            </span>
          </Link>

          {/* Nav Items */}
          <div className="flex items-center gap-4">
            {/* Profile */}
            <Link
              href="/student/profile"
              className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              Profile
            </Link>

            {/* Courses Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCoursesDropdownOpen(!coursesDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
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
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-red-100 z-50 overflow-hidden">
                    <div className="p-4 border-b border-red-100 bg-red-50">
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
                        <div className="divide-y divide-red-50">
                          {enrolledCourses.map((course) => {
                            // Calculate progress (mock - replace with real calculation)
                            const progress = Math.floor(Math.random() * 40) + 50;
                            
                            return (
                              <Link
                                key={course.id}
                                href={`/student/dashboard/${course.id}/content`}
                                onClick={() => setCoursesDropdownOpen(false)}
                                className="block p-4 hover:bg-red-50 transition-colors"
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
                                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
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
                    {/* Footer actions removed: enrollment is admin-managed, and students already view courses from dashboard. */}
                  </div>
                </>
              )}
            </div>

              {/* Logout (no icon) */}
              <button 
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
              >
                Logout
              </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

