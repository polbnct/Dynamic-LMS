"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import ProfessorNavbar, { type ProfessorNavbarRef } from "@/utils/ProfessorNavbar";
import { updateCourse, deleteCourse, type CourseWithStudents } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";

export default function ProfessorDashboard() {
  const navbarRef = useRef<ProfessorNavbarRef>(null);
  const { courses, handledCourses, loading, error: contextError, refetch } = useProfessorCourses();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [editingCourse, setEditingCourse] = useState<CourseWithStudents | null>(null);
  const [editCourseModalOpen, setEditCourseModalOpen] = useState(false);
  const [editCourseForm, setEditCourseForm] = useState({ name: "", code: "" });
  const [savingCourse, setSavingCourse] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);

  const openEditCourseModal = (course: CourseWithStudents) => {
    setEditingCourse(course);
    setEditCourseForm({ name: course.name, code: course.code });
    setError("");
    setSuccess("");
    setEditCourseModalOpen(true);
  };

  const closeEditCourseModal = () => {
    setEditCourseModalOpen(false);
    setEditingCourse(null);
    setEditCourseForm({ name: "", code: "" });
    setSavingCourse(false);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    if (!editCourseForm.name.trim()) {
      setError("Course name is required.");
      return;
    }
    setSavingCourse(true);
    setError("");
    setSuccess("");
    try {
      await updateCourse(editingCourse.id, {
        name: editCourseForm.name.trim(),
        code: editCourseForm.code.trim() || editingCourse.code,
      });
      await refetch();
      setSuccess("Course updated.");
      setTimeout(() => setSuccess(""), 3000);
      closeEditCourseModal();
    } catch (err: any) {
      console.error("Error updating course:", err);
      setError(err?.message || "Failed to update course. Please try again.");
    } finally {
      setSavingCourse(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Professor Navbar - same courses as dashboard, create works from anywhere */}
      <ProfessorNavbar
        ref={navbarRef}
        currentPage="dashboard"
        canCreateCourse={false}
        handledCourses={handledCourses}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Welcome Back, Professor!
          </h1>
          <p className="text-gray-600">Manage your courses and students</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {success}
          </div>
        )}

        {/* Error Message */}
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

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* Course Cards Grid */}
        {!loading && (
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
                <p className="text-gray-600 mb-6">Create your first course to get started</p>
                <button
                  onClick={() => {
                    // Trigger the navbar's create course modal
                    navbarRef.current?.openCreateModal();
                  }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
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
                    <div className="mt-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            openEditCourseModal(course);
                          }}
                          className="w-full px-3 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingCourseId === course.id}
                          onClick={async (e) => {
                            e.preventDefault();
                            if (
                              !confirm(
                                `Delete course "${course.name}"? This will remove assignments, quizzes, lessons, enrollments, and cannot be undone.`
                              )
                            ) {
                              return;
                            }
                            setError("");
                            setDeletingCourseId(course.id);
                            try {
                              await deleteCourse(course.id);
                              await refetch();
                            } catch (err: any) {
                              console.error("Error deleting course from dashboard:", err);
                              setError(err?.message || "Failed to delete course. Please try again.");
                            } finally {
                              setDeletingCourseId(null);
                            }
                          }}
                          className="w-full px-3 py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingCourseId === course.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Edit course modal */}
        {editCourseModalOpen && editingCourse && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeEditCourseModal}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Edit course
                </h2>
                <button
                  type="button"
                  onClick={closeEditCourseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSaveCourse} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course name
                  </label>
                  <input
                    type="text"
                    value={editCourseForm.name}
                    onChange={(e) => setEditCourseForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course code <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editCourseForm.code}
                    onChange={(e) => setEditCourseForm((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 focus:bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    If left blank, the current course code ({editingCourse.code}) will be kept.
                  </p>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditCourseModal}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCourse}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingCourse ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
