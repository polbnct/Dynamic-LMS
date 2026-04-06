"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/feedback/ToastProvider";
import StudentNavbar from "@/utils/StudentNavbar";
import { getStudentCourses, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { getAssignments } from "@/lib/supabase/queries/assignments";
import { getQuizzes } from "@/lib/supabase/queries/quizzes";
import type { CourseWithStudents } from "@/lib/supabase/queries/courses.client";

export default function StudentDashboard() {
  const { error: toastError } = useToast();
  const [courses, setCourses] = useState<CourseWithStudents[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<any[]>([]);
  const [upcomingQuizzes, setUpcomingQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const isSearching = search.trim().length > 0;

  const filteredCourses = useMemo(() => {
    const filtered = courses.filter((course) =>
    (course.name + " " + course.code + " " + (course.professorName || ""))
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const lastAccessed = localStorage.getItem("lastAccessedCourse");
    if (!lastAccessed) return filtered;

    return [...filtered].sort((a, b) => {
    if (a.id === lastAccessed) return -1;
    if (b.id === lastAccessed) return 1;
    return 0;
  });
}, [courses, search]);

  const getCourseName = (courseId: string) => {
    return courses.find (c => c.id === courseId)?.name || "Unknown Course";
  };

  

  useEffect(() => {
    async function fetchData() {
      try {
        const studentId = await getCurrentStudentId();
        if (!studentId) {
          throw new Error("Student not found");
        }

        const coursesData = await getStudentCourses(studentId);
        setCourses(coursesData);

        // Get upcoming assignments & quizzes from all enrolled courses
        const courseIds = coursesData.map((c) => c.id);
        if (courseIds.length > 0) {
          const [allAssignments, allQuizzes] = await Promise.all([
            Promise.all(courseIds.map((id) => getAssignments(id))),
            Promise.all(courseIds.map((id) => getQuizzes(id))),
          ]);

          // Ensure every upcoming item has a valid course_id by forcing it
          // to the originating courseId (ignore whatever is on the row).
          const flattenedAssignments = allAssignments.flatMap((list, index) =>
            (list || []).map((a: any) => ({
              ...a,
              course_id: courseIds[index],
            }))
          );
          const upcomingA = flattenedAssignments
            .filter((a) => a.course_id)
            .filter((a) => a.due_date && new Date(a.due_date) > new Date())
            .sort(
              (a, b) =>
                new Date(a.due_date as string).getTime() -
                new Date(b.due_date as string).getTime()
            )
            .slice(0, 5);
          setUpcomingAssignments(upcomingA);

          const flattenedQuizzes = allQuizzes.flatMap((list, index) =>
            (list || []).map((q: any) => ({
              ...q,
              course_id: courseIds[index],
            }))
          );
          const upcomingQ = flattenedQuizzes
            .filter((q) => q.course_id)
            .filter((q) => q.due_date && new Date(q.due_date) > new Date())
            .sort(
              (a, b) =>
                new Date(a.due_date as string).getTime() -
                new Date(b.due_date as string).getTime()
            )
            .slice(0, 5);
          setUpcomingQuizzes(upcomingQ);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        toastError(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [toastError]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <StudentNavbar currentPage="dashboard" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <StudentNavbar currentPage="dashboard" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Top Banner Image */}
        <div className="w-full mb-8">
          <div className="w-full h-40 sm:h-52 md:h-60 lg:h-72 overflow-hidden rounded-3xl shadow-xl">
            <img
              src="/dashboard_image.svg"
              alt="Dashboard Banner"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* My Courses */}
        <div className="mb-8">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">My Courses</h2>
          <div className="w-full sm:w-98 flex items-center rounded-2xl border border-red-200 bg-white px-3 py-2 shadow-sm focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-100 transition">
      <svg
        className="h-5 w-5 text-gray-400 ml-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

            <input
              type="text"
              placeholder="Search by course name, code, or instructor"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-700 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {isSearching && (
              <button
                onClick={() => setSearch("")}
                className="ml-2 shrink-0 border-l border-red-100 pl-3 text-sm font-medium text-red-600 hover:text-red-700 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
          {courses.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-rose-100 p-12 text-center">
              <p className="text-gray-600">
                No courses enrolled yet
              </p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-rose-100 p-12 text-center">
              <p className="text-gray-600">No matching courses found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {filteredCourses.slice(0, 6).map((course) => (
                <Link
                  key={course.id}
                  href={`/student/dashboard/${course.id}/content`}
                  className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg border border-rose-100 p-6 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
                  onClick={() => {
                  localStorage.setItem("lastAccessedCourse", course.id);
                }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1 truncate flex-1" title={course.name}> 
                    {course.name}
                  </h3>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-8 h-8 text-gray-700 ml-2 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.253v11.494m0-11.494C10.832 5.477 9.246 5 7.5 5A3.5 3.5 0 004 8.5v9A3.5 3.5 0 017.5 14c1.746 0 3.332.477 4.5 1.253m0-9C13.168 5.477 14.754 5 16.5 5A3.5 3.5 0 0120 8.5v9A3.5 3.5 0 0016.5 14c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {course.code}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {course.professorName || "No instructor"}
                  </p>
                  <div className="mt-4 grid grid-cols-3 border border-gray-200 rounded-xl overflow-hidden divide-x divide-gray-200">
                  <span className="py-3 text-center text-xs font-medium text-gray-700">
                    {course.lessonsCount|| 0} Lessons
                  </span>

                  <span className="py-3 text-center text-xs font-medium text-gray-700">
                    {course.assignmentsCount || 0} Assignments
                  </span>

                  <span className="py-3 text-center text-xs font-medium text-gray-700">
                    {course.quizzesCount || 0} Quizzes
                  </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Assignments */}
        {upcomingAssignments.filter((a) => a.course_id && a.course_id !== "undefined").length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Upcoming Assignments</h2>
            <div className="space-y-3">
              {upcomingAssignments
                .filter((assignment) => assignment.course_id && assignment.course_id !== "undefined")
                .map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/student/dashboard/${assignment.course_id}/assignments`}
                    className="block bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-rose-100 p-4 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className ="min-w-0 flex-1">
                        <p className="text-xs text-gray-800 truncate">
                          {getCourseName(assignment.course_id)}
                        </p>
                        <h4 className="font-semibold text-gray-800 truncate" title={assignment.title}>
                          {assignment.title}
                        </h4>
                        <p className="text-sm text-gray-500 break-words">
                          Due:{" "}
                          {assignment.due_date
                            ? new Date(assignment.due_date).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "No due date"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-rose-600">View assignment</span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}

        {/* Upcoming Quizzes */}
        {upcomingQuizzes.filter((q) => q.course_id && q.course_id !== "undefined").length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Upcoming Quizzes</h2>
            <div className="space-y-3">
              {upcomingQuizzes
                .filter((quiz) => quiz.course_id && quiz.course_id !== "undefined")
                .map((quiz) => (
                  <Link
                    key={quiz.id}
                    href={`/student/dashboard/${quiz.course_id}/quizzes`}
                    className="block bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-rose-100 p-4 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-800 truncate">
                          {getCourseName(quiz.course_id)}
                        </p>
                        <h4 className="font-semibold text-gray-800 truncate" title={quiz.name}
                        > {quiz.name} </h4>
                        <p className="text-sm text-gray-500 break-words">
                          Locks:{" "}
                          {quiz.due_date
                            ? new Date(quiz.due_date).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "No lock time"}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-rose-600">View quiz</span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SidebarNavItem({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <a
      href="#"
      className={
        "flex items-center gap-3 py-2 px-4 rounded-lg font-medium text-lg " +
        (active ? "bg-red-100 text-red-700" : "text-red-500 hover:bg-red-50 hover:text-red-700")
      }
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}





