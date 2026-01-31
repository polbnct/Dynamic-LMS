"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import { getStudentCourses, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { getAssignments } from "@/lib/supabase/queries/assignments";
import type { CourseWithStudents } from "@/lib/supabase/queries/courses.client";

export default function StudentDashboard() {
  const [courses, setCourses] = useState<CourseWithStudents[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<any[]>([]);
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

        // Get upcoming assignments from all courses
        const courseIds = coursesData.map((c) => c.id);
        if (courseIds.length > 0) {
          const allAssignments = await Promise.all(
            courseIds.map((id) => getAssignments(id))
          );
          const flattened = allAssignments.flat();
          const upcoming = flattened
            .filter((a) => a.due_date && new Date(a.due_date) > new Date())
            .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
            .slice(0, 5);
          setUpcomingAssignments(upcoming);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-red-50">
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
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-red-50">
      <StudentNavbar currentPage="dashboard" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-700 via-rose-600 to-red-500 bg-clip-text text-transparent mb-8">
          Dashboard
        </h1>

        {/* My Courses */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">My Courses</h2>
          {courses.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-rose-100 p-12 text-center">
              <p className="text-gray-600">No courses enrolled yet</p>
              <Link
                href="/student/courses"
                className="mt-4 inline-block text-red-600 hover:text-red-700 font-semibold"
              >
                Browse Courses
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {courses.slice(0, 6).map((course) => (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}/content`}
                  className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg border border-rose-100 p-6 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
                >
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">{course.name}</h3>
                  <p className="text-sm text-gray-500">{course.code}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Assignments */}
        {upcomingAssignments.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Upcoming Assignments</h2>
            <div className="space-y-3">
              {upcomingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-rose-100 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">{assignment.title}</h4>
                      <p className="text-sm text-gray-500">
                        Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : "No due date"}
                      </p>
                    </div>
                  </div>
                </div>
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





