"use client";

import React from "react";
import Link from "next/link";

interface StudentCourseNavbarProps {
  courseId: string;
  currentPage: "assignments" | "quizzes" | "grades" | "content";
  courseName?: string;
  courseCode?: string;
}

export default function StudentCourseNavbar({
  courseId,
  currentPage,
  courseName,
  courseCode,
}: StudentCourseNavbarProps) {
  const navItems = [
    {
      name: "Assignments",
      href: `/student/courses/${courseId}/assignments`,
      key: "assignments" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      name: "Quizzes",
      href: `/student/courses/${courseId}/quizzes`,
      key: "quizzes" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      name: "Grades",
      href: `/student/courses/${courseId}/grades`,
      key: "grades" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      name: "Content",
      href: `/student/courses/${courseId}/content`,
      key: "content" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav className="bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Course Info */}
        {(courseName || courseCode) && (
          <div className="pt-4 pb-2 border-b border-gray-200">
            <Link
              href={`/student/courses/${courseId}/content`}
              className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >
              {courseCode && <span className="font-medium">{courseCode}</span>}
              {courseName && courseCode && " • "}
              {courseName && <span>{courseName}</span>}
            </Link>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex items-center gap-1 py-2">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                currentPage === item.key
                  ? "bg-indigo-100 text-indigo-600"
                  : "text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

