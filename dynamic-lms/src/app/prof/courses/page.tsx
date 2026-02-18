"use client";

import React, { useState } from "react";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import { getInviteLink, updateCourseInviteCode, type CourseWithStudents } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";

export default function ProfCoursesPage() {
  const { courses, handledCourses, loading, error: contextError, createCourse } = useProfessorCourses();
  const [error, setError] = useState("");
  const [inviteCourse, setInviteCourse] = useState<CourseWithStudents | null>(null);
  const [inviteCodeRegenerating, setInviteCodeRegenerating] = useState(false);
  const [inviteCopied, setInviteCopied] = useState<"link" | "code" | null>(null);

  const handleCreateCourse = async (courseName: string) => {
    try {
      await createCourse(courseName);
      setError("");
    } catch (err) {
      setError("Failed to create course. Please try again.");
      console.error("Error creating course:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Professor Navbar - same courses as dashboard */}
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} onCreateCourse={handleCreateCourse} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            My Courses
          </h1>
          <p className="text-gray-600">Manage your courses and view enrolled students</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* Error State */}
        {(error || contextError) && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
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
            {error || contextError}
          </div>
        )}

        {/* Course Cards Grid */}
        {!loading && !error && !contextError && (
          <>
            {courses.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                  <svg
                    className="w-12 h-12 text-indigo-600"
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
                <p className="text-gray-600">Create your first course to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                  >
                    <Link href={`/prof/courses/${course.id}`} className="block">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
                            {course.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">{course.code}</p>
                          <p className="text-xs text-gray-400 mt-1">Invite code: {course.classroom_code}</p>
                        </div>
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg
                            className="w-8 h-8 text-indigo-600"
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
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg
                            className="w-5 h-5 text-indigo-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          <span className="font-semibold">{course.studentsCount}</span>
                          <span>student{course.studentsCount !== 1 ? "s" : ""} enrolled</span>
                        </div>
                      </div>
                    </Link>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setInviteCourse(course);
                          setInviteCopied(null);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Invite students
                      </button>
                      <Link
                        href={`/prof/courses/${course.id}`}
                        className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Invite students modal */}
        {inviteCourse && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setInviteCourse(null); setInviteCopied(null); }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Invite students to {inviteCourse.name}
                </h2>
                <button
                  type="button"
                  onClick={() => { setInviteCourse(null); setInviteCopied(null); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Share the invite link or code with students. They can join from the &quot;Join with code&quot; page when logged in.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Invite link</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={getInviteLink(inviteCourse.classroom_code)}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(getInviteLink(inviteCourse.classroom_code));
                          setInviteCopied("link");
                          setTimeout(() => setInviteCopied(null), 2000);
                        } catch (e) {
                          console.error("Copy failed", e);
                        }
                      }}
                      className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700"
                    >
                      {inviteCopied === "link" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Invite code</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={inviteCourse.classroom_code}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteCourse.classroom_code);
                          setInviteCopied("code");
                          setTimeout(() => setInviteCopied(null), 2000);
                        } catch (e) {
                          console.error("Copy failed", e);
                        }
                      }}
                      className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700"
                    >
                      {inviteCopied === "code" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={inviteCodeRegenerating}
                  onClick={async () => {
                    const professorId = await getCurrentProfessorId(false);
                    if (!professorId) return;
                    setInviteCodeRegenerating(true);
                    try {
                      const newCode = await updateCourseInviteCode(inviteCourse.id, professorId);
                      setInviteCourse({ ...inviteCourse, classroom_code: newCode });
                      setCourses((prev) =>
                        prev.map((c) => (c.id === inviteCourse.id ? { ...c, classroom_code: newCode } : c))
                      );
                    } catch (err: any) {
                      setError(err?.message || "Failed to regenerate code");
                    } finally {
                      setInviteCodeRegenerating(false);
                    }
                  }}
                  className="w-full py-2.5 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 disabled:opacity-50"
                >
                  {inviteCodeRegenerating ? "Regenerating…" : "Regenerate invite code"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
