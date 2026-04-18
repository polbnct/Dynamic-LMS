"use client";

import React from "react";
import Link from "next/link";

interface CourseNavbarProps {
  courseId: string;
  currentPage: "content" | "assignments" | "quizzes" | "announcements" | "classlist";
  courseName?: string;
  courseCode?: string;
}

export default function CourseNavbar({
  courseId,
  currentPage,
  courseName,
  courseCode,
}: CourseNavbarProps) {
  const navItems = [
  {
        name: "Content",
        href: `/prof/courses/${courseId}/content`,
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
    {
      name: "Assignments",
      href: `/prof/courses/${courseId}/assignments`,
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
      href: `/prof/courses/${courseId}/quizzes`,
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
      name: "Announcements",
      href: `/prof/courses/${courseId}/announcements`,
      key: "announcements" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>
      ),
    },
    {
      name: "Classlist",
      href: `/prof/courses/${courseId}/classlist`,
      key: "classlist" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    
  ];

  return (
    <nav className="bg-white/90 backdrop-blur-sm border-b border-rose-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Course Info */}
        {(courseName || courseCode) && (
          <div className="pt-2 sm:pt-4 pb-2 border-b border-rose-100">
            <div className="block truncate text-xs sm:text-sm text-gray-600">
              {courseCode && <span className="font-medium">{courseCode}</span>}
              {courseName && courseCode && " • "}
              {courseName && <span>{courseName}</span>}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="overflow-x-auto py-2">
          <div className="flex w-max min-w-full items-center justify-center sm:justify-start gap-1 sm:gap-2 pr-1">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`inline-flex shrink-0 items-center gap-2 px-2.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors ${
                currentPage === item.key
                  ? "bg-rose-100 text-red-600"
                  : "text-gray-700 hover:bg-red-50 hover:text-red-600"
              }`}
            >
              <span className="hidden sm:inline-flex">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

