"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import CourseNavbar from "@/utils/CourseNavbar";
import { getCourseById, getCourseStudents, type CourseWithStudents } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { getStudentGrades } from "@/lib/supabase/queries/grades";
import type { Grade } from "@/lib/supabase/queries/grades";
import { getAssignments } from "@/lib/supabase/queries/assignments";
import { getQuizzes } from "@/lib/supabase/queries/quizzes";

interface Student {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  studentDbId?: string;
  enrolledAt: string;
}

export default function ClasslistPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseWithStudents | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [profileGrades, setProfileGrades] = useState<Grade[]>([]);
  const [profileMissedAssignments, setProfileMissedAssignments] = useState<{ id: string; title: string; category: string }[]>([]);
  const [profileMissedQuizzes, setProfileMissedQuizzes] = useState<{ id: string; name: string }[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const { handledCourses, createCourse } = useProfessorCourses();

  useEffect(() => {
    async function fetchCourseData() {
      try {
        setLoading(true);
        const [courseData, studentsData] = await Promise.all([
          getCourseById(courseId),
          getCourseStudents(courseId).catch(() => []),
        ]);

        if (!courseData) {
          setError("Course not found");
          return;
        }

        setCourse(courseData);
        setStudents(Array.isArray(studentsData) ? studentsData : []);
        setError("");
      } catch (err) {
        setError("Failed to load course data. Please try again.");
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }

    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  // Filter students based on search query
  const filteredStudents = students.filter((student) => {
    const query = searchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.email.toLowerCase().includes(query) ||
      student.studentId?.toLowerCase().includes(query)
    );
  });


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} onCreateCourse={createCourse} />
        <CourseNavbar courseId={courseId} currentPage="classlist" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} onCreateCourse={createCourse} />
        <CourseNavbar courseId={courseId} currentPage="classlist" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
            {error || "Course not found"}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Professor Navbar */}
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} onCreateCourse={createCourse} />

      {/* Course Navbar */}
      <CourseNavbar
        courseId={courseId}
        currentPage="classlist"
        courseName={course.name}
        courseCode={course.code}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <Link
            href="/prof/courses"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Courses
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Classlist
              </h1>
              <p className="text-gray-600">{course.name} ({course.code})</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Total Students</div>
              <div className="text-3xl font-bold text-indigo-600">{course.studentsCount}</div>
            </div>
          </div>
        </div>

        {/* Students Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Enrolled Students</h2>

            {/* Search Bar */}
            <div className="relative w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
              />
            </div>
          </div>

          {/* Students Table */}
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-600">
                {searchQuery ? "No students found matching your search." : "No students enrolled yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Student ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Enrolled Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-semibold">
                              {student.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-gray-800">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">{student.email}</td>
                      <td className="py-4 px-4 text-gray-600">{student.studentId || "N/A"}</td>
                      <td className="py-4 px-4 text-gray-600">
                        {new Date(student.enrolledAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={async () => {
                            if (!student.studentDbId) return;
                            setSelectedStudent(student);
                            setProfileModalOpen(true);
                            setProfileLoading(true);
                            setProfileGrades([]);
                            setProfileMissedAssignments([]);
                            setProfileMissedQuizzes([]);
                            try {
                              const [grades, assignments, quizzes] = await Promise.all([
                                getStudentGrades(courseId, student.studentDbId),
                                getAssignments(courseId),
                                getQuizzes(courseId),
                              ]);
                              setProfileGrades(grades ?? []);
                              const gradedAssignmentTitles = new Set(
                                (grades ?? []).filter((g) => g.type === "assignment").map((g) => g.title)
                              );
                              const gradedQuizTitles = new Set(
                                (grades ?? []).filter((g) => g.type === "quiz").map((g) => g.title)
                              );
                              setProfileMissedAssignments(
                                (assignments ?? []).filter((a) => !gradedAssignmentTitles.has(a.title))
                              );
                              setProfileMissedQuizzes((quizzes ?? []).filter((q) => !gradedQuizTitles.has(q.name)));
                            } catch (err) {
                              console.error("Error loading student profile:", err);
                              setError("Failed to load student grades.");
                            } finally {
                              setProfileLoading(false);
                            }
                          }}
                          className="text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {filteredStudents.length} of {students.length} student{students.length !== 1 ? "s" : ""}
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Student Profile / Grades Modal */}
      {profileModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Student profile</h2>
                <p className="text-gray-600 text-sm mt-1">{selectedStudent.name}</p>
                {selectedStudent.email && (
                  <p className="text-gray-500 text-sm">{selectedStudent.email}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setProfileModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {profileLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Grades in this course */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                      Grades in this course
                    </h3>
                    {profileGrades.length === 0 ? (
                      <p className="text-gray-500 text-sm">No graded assignments or quizzes yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {profileGrades.map((g) => (
                          <li
                            key={g.id}
                            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <div>
                              <span className="font-medium text-gray-800">{g.title}</span>
                              <span className="ml-2 text-xs text-gray-500 capitalize">({g.type})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-600">
                                {g.score}/{g.maxScore}
                              </span>
                              <span className="text-sm font-medium text-indigo-600">{Math.round(g.percentage)}%</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Missed assignments */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                      Missed assignments
                    </h3>
                    {profileMissedAssignments.length === 0 ? (
                      <p className="text-gray-500 text-sm">None. Student submitted all assignments.</p>
                    ) : (
                      <ul className="space-y-2">
                        {profileMissedAssignments.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center gap-2 py-2 px-3 bg-red-50 rounded-lg border border-red-100 text-red-800 text-sm"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {a.title}
                            <span className="text-red-600 text-xs capitalize">({a.category})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Missed quizzes */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                      Missed quizzes
                    </h3>
                    {profileMissedQuizzes.length === 0 ? (
                      <p className="text-gray-500 text-sm">None. Student took all quizzes.</p>
                    ) : (
                      <ul className="space-y-2">
                        {profileMissedQuizzes.map((q) => (
                          <li
                            key={q.id}
                            className="flex items-center gap-2 py-2 px-3 bg-red-50 rounded-lg border border-red-100 text-red-800 text-sm"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {q.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

