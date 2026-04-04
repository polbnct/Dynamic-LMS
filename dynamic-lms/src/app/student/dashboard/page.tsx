"use client";

import React, { useEffect, useState } from "react";
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
          <h2 className="text-2xl font-bold text-gray-800 mb-4">My Courses</h2>
          {courses.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-rose-100 p-12 text-center">
              <p className="text-gray-600">No courses enrolled yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {courses.slice(0, 6).map((course) => (
                <Link
                  key={course.id}
                  href={`/student/dashboard/${course.id}/content`}
                  className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg border border-rose-100 p-6 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
                >
                  <h3 className="text-xl font-semibold text-gray-900 mb-1 truncate"
                  title={course.name}
                  > {course.name}
                </h3>
                  <p className="text-sm text-gray-500 truncate">{course.code}</p>
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





