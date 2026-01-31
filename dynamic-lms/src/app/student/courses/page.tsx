"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import { getStudentCourses, getCurrentStudentId, CourseWithStudents } from "@/lib/mockData/courses";

export default function StudentCourses() {
  const [courses, setCourses] = useState<CourseWithStudents[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const studentId = getCurrentStudentId();
        const enrolledCourses = await getStudentCourses(studentId);
        setCourses(enrolledCourses);
      } catch (err) {
        console.error("Error fetching courses:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-red-50">
        <StudentNavbar currentPage="courses" />
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
      <StudentNavbar currentPage="courses" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-700 via-rose-600 to-red-500 bg-clip-text text-transparent mb-8">
          My Courses
        </h1>
        
        {courses.length === 0 ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-rose-100 p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-rose-100 to-red-100 rounded-full mb-6 shadow-inner">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">No courses yet</h3>
            <p className="text-gray-600">Join a course to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {courses.map((course) => {
              return (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}/content`}
                  className="group bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg border border-rose-100 p-6 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <p className="text-xs font-semibold tracking-[0.2em] text-rose-400 uppercase">Course</p>
                      <h3 className="text-2xl font-semibold text-gray-900 mb-1 group-hover:text-red-600 transition-colors">
                        {course.name}
                      </h3>
                      <p className="text-sm text-gray-500 tracking-wide">{course.code}</p>
                      <p className="text-xs text-gray-400 mt-2">{course.professorName}</p>
                    </div>
                    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 group-hover:bg-red-500 group-hover:text-white transition-colors shadow-inner">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-rose-500" />
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
