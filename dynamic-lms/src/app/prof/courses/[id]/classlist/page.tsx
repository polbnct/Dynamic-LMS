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
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";

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
  const { handledCourses } = useProfessorCourses();
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());

  useSyncMessagesToToast(error, "");

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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />
        <CourseNavbar courseId={courseId} currentPage="classlist" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />
        <CourseNavbar courseId={courseId} currentPage="classlist" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-700">
            <p className="mb-4">This class list could not be loaded.</p>
            <Link href="/prof" className="font-semibold text-red-600 hover:underline">
              Back to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      {/* Professor Navbar */}
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />

      {/* Course Navbar */}
      <CourseNavbar
        courseId={courseId}
        currentPage="classlist"
        courseName={course.name}
        courseCode={course.code}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <Link
            href="/prof/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-red-600 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0 ">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 break-words">
                Classlist
              </h1>
              <p className="text-sm sm:text-base text-gray-600 truncate">{course.name} ({course.code})</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-sm text-gray-600">Total Students</div>
              <div className="text-3xl font-bold text-red-600">{course.studentsCount}</div>
            </div>
          </div>
        </div>

        {/* Students Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Enrolled Students</h2>

            {/* Search Bar */}
            <div className="relative w-full md:w-75">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
              />
            </div>
          </div>

          {/* Students Table */}
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-rose-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-800">
                {searchQuery ? "No students found matching your search." : "No students enrolled yet."}
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto lg:overflow-x-visible scrollbar-thin scrollbar-thumb-red-200">
              <table className="w-full min-w-[920px] lg:min-w-0 table-fixed relative">
                <thead className= "sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-200">
                    <th className="w-[30%] text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                    <th className="w-[30%] text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                    <th className="w-[16%] text-left py-3 px-4 text-sm font-semibold text-gray-700">Student ID</th>
                    <th className="w-[14%] text-left py-3 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap">Enrolled Date</th>
                    <th className="w-[10%] text-left py-3 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-red-50/50 transition-colors">
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 shrink-0 flex-none bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center">
                            <span className="text-red-600 font-semibold">
                              {student.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-gray-800 truncate" title={student.name}>
                            {student.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600 align-top">
                      <span className="block truncate" title={student.email}>
                        {student.email}
                        </span> 
                      </td>

                      <td className="py-4 px-4 text-gray-600 align-top">
                        <span className="block truncate"
                          title={student.studentId}>
                            {student.studentId || "N/A"}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-gray-600 align-top whitespace-nowrap">
                        {new Date(student.enrolledAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <div className="flex items-center gap-3 shrink-0">
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
                            className="text-red-600 hover:text-red-700 font-medium text-sm transition-colors"
                          >
                            View Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600">
            <span>
              Showing {filteredStudents.length} of {students.length} student{students.length !== 1 ? "s" : ""}
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-red-600 hover:text-red-700 font-medium"
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="p-5 sm:p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Student Profile</h2>
                <div className="flex items-center gap-3 mt-3">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center">
                    <span className="text-red-600 font-bold text-md">
                      {selectedStudent.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium">{selectedStudent.name}</p>
                    {selectedStudent.email && (
                      <p className="text-gray-500 text-xs">{selectedStudent.email}</p>
                    )}
                    {selectedStudent.studentId && (
                      <p className="text-gray-400 text-xs">ID: {selectedStudent.studentId}</p>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setProfileModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-colors rounded-lg p-1.5 shrink-0 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">graded items</p>
                  <p className="text-lg font-bold text-gray-900">{profileGrades.length}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">missed assignments</p>
                    <p className="text-lg font-bold text-amber-700">{profileMissedAssignments.length}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">missed quizzes</p>
                    <p className="text-lg font-bold text-amber-700">{profileMissedQuizzes.length}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-gray-50/40">
            {(() => {
              const groupedGrades = profileGrades.reduce((acc, grade) => {
                const key = `${grade.title}-${grade.type}`;
                if (!acc[key]) {
                  acc[key] = [];
                }
                acc[key].push(grade);
                return acc;
              }, {} as Record<string, Grade[]>);

              const sortedGroupedGrades = Object.values(groupedGrades)
                .map(grades => ({
                  title: grades[0].title,
                  type: grades[0].type,
                  grades: grades.sort((a, b) => b.percentage - a.percentage),
                  latestGrade: grades.sort((a, b) => b.percentage - a.percentage)[0]
                }))
                .sort((a, b) => a.title.localeCompare(b.title));

              const toggleGradeExpand = (key: string) => {
                setExpandedGrades(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) {
                    next.delete(key);
                  } else {
                    next.add(key);
                  }
                  return next;
                });
              };

              return profileLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Grades in this course */}
                  <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                      Grades in this course
                    </h3>
                    {sortedGroupedGrades.length === 0 ? (
                      <p className="text-gray-500 text-sm">No graded assignments or quizzes yet.</p>
                    ) : (
                      <ul className="space-y-3">
                        {sortedGroupedGrades.map((group, idx) => {
                          const key = `${group.title}-${group.type}-${idx}`;
                          const isExpanded = expandedGrades.has(key);
                          const hasMultiple = group.grades.length > 1;
                          
                          return (
                           <li key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div 
                              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-3 bg-gray-50 ${hasMultiple ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                              onClick={() => hasMultiple && toggleGradeExpand(key)}
                            >
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex items-start gap-2">
                                  <span className="font-medium text-gray-800 break-words text-sm sm:text-base flex-1">
                                    {group.title}
                                  </span>
                                  {hasMultiple && (
                                    <svg 
                                      className={`w-4 h-4 text-gray-500 transition-transform shrink-0 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 capitalize">{group.type}</span>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                                  Latest: {group.latestGrade.score}/{group.latestGrade.maxScore}
                                </span>
                                <span className="text-xs sm:text-sm font-medium text-red-600 whitespace-nowrap">
                                  {Math.round(group.latestGrade.percentage)}%
                                </span>
                              </div>
                            </div>
                              
                              {/* Dropdown for previous grades */}
                              {hasMultiple && isExpanded && (
                                <div className="border-t border-gray-100 bg-white">
                                  <ul className="divide-y divide-gray-50">
                                    {group.grades.slice(1).map((grade, gradeIdx) => (
                                      <li key={gradeIdx} className="py-3 px-3 sm:px-4">
                                         <div className="flex flex-wrap items-center gap-1">
                                          <span className="text-xs sm:text-sm text-gray-600">
                                            Attempt #{group.grades.length - gradeIdx}
                                          </span>
                                          <span className="text-xs text-gray-400">
                                            {grade.id ? `(${grade.id.slice(-6)})` : ''}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-3">
                                          <span className="text-xs sm:text-sm text-gray-600">
                                            {grade.score}/{grade.maxScore}
                                          </span>
                                          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                                            {Math.round(grade.percentage)}%
                                          </span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  {/* Missed assignments */}
                  <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                      Missed assignments
                    </h3>
                    {profileMissedAssignments.length === 0 ? (
                      <p className="text-gray-500 text-sm">None. Student submitted all assignments.</p>
                    ) : (
                      <ul className="space-y-2">
                        {profileMissedAssignments.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center gap-2 py-2.5 px-3 bg-red-50 rounded-lg border border-red-100 text-red-800 text-sm"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {a.title}
                            <span className="text-red-600 text-xs capitalize shrink-0">({a.category})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Missed quizzes */}
                  <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                      Missed quizzes
                    </h3>
                    {profileMissedQuizzes.length === 0 ? (
                      <p className="text-gray-500 text-sm">None. Student took all quizzes.</p>
                    ) : (
                      <ul className="space-y-2">
                        {profileMissedQuizzes.map((q) => (
                          <li
                            key={q.id}
                            className="flex items-center gap-2 py-2.5 px-3 bg-red-50 rounded-lg border border-red-100 text-red-800 text-sm"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="min-w-0 flex-1 truncate" title={q.name}>
                              {q.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
                );
              })()}
            </div>
            <div className="border-t border-gray-200 p-4 bg-white flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setProfileModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

