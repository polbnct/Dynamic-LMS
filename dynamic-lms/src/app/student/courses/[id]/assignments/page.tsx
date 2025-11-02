"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById } from "@/lib/mockData/courses";

// Assignment interface
interface Assignment {
  id: string;
  title: string;
  description?: string;
  category: "prelim" | "midterm" | "finals";
  pdfUrl?: string;
  pdfFileName?: string;
  createdAt: string;
  dueDate?: string;
  submitted?: boolean;
  submittedAt?: string;
}

// Mock assignments data
const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "1",
    title: "Set Theory Exercise",
    description: "Complete exercises on sets, subsets, and operations",
    category: "prelim",
    pdfFileName: "Set_Theory_Exercise.pdf",
    createdAt: "2024-01-20T10:00:00Z",
    dueDate: "2024-02-05T23:59:00Z",
    submitted: true,
    submittedAt: "2024-02-03T14:30:00Z",
  },
  {
    id: "2",
    title: "Logic Problems",
    description: "Solve propositional logic problems",
    category: "prelim",
    pdfFileName: "Logic_Problems.pdf",
    createdAt: "2024-01-25T10:00:00Z",
    dueDate: "2024-02-10T23:59:00Z",
    submitted: false,
  },
  {
    id: "3",
    title: "Function Analysis",
    description: "Analyze different types of functions and relations",
    category: "midterm",
    pdfFileName: "Function_Analysis.pdf",
    createdAt: "2024-02-01T10:00:00Z",
    dueDate: "2024-02-20T23:59:00Z",
    submitted: false,
  },
];

export default function StudentAssignmentsPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        // In real implementation, fetch assignments from API
        setAssignments(MOCK_ASSIGNMENTS);
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

  // Group assignments by category
  const assignmentsByCategory = {
    prelim: assignments.filter((a) => a.category === "prelim"),
    midterm: assignments.filter((a) => a.category === "midterm"),
    finals: assignments.filter((a) => a.category === "finals"),
  };

  const categoryLabels = {
    prelim: "Prelim",
    midterm: "Midterm",
    finals: "Finals",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <StudentNavbar currentPage="courses" />
        <StudentCourseNavbar courseId={courseId} currentPage="assignments" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalAssignments = assignments.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Main Student Navbar */}
      <StudentNavbar currentPage="courses" />
      
      {/* Student Course Navbar */}
      <StudentCourseNavbar
        courseId={courseId}
        currentPage="assignments"
        courseName={course?.name}
        courseCode={course?.code}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <Link
            href="/student/courses"
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
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Assignments
            </h1>
            <p className="text-gray-600">
              {course?.name} ({course?.code}) • {totalAssignments} assignment{totalAssignments !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Assignments by Category */}
        {totalAssignments === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No assignments available</h3>
              <p className="text-gray-600">Assignments will appear here when your professor adds them</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {(["prelim", "midterm", "finals"] as const).map((category) => {
              const categoryAssignments = assignmentsByCategory[category];
              if (categoryAssignments.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                      {categoryAssignments.length} assignment{categoryAssignments.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Assignments List */}
                  <div className="space-y-4">
                    {categoryAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-800">{assignment.title}</h3>
                              {assignment.submitted && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                  Submitted
                                </span>
                              )}
                            </div>
                            {assignment.description && (
                              <p className="text-gray-600 mb-4">{assignment.description}</p>
                            )}
                            <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                              {assignment.pdfFileName && (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <span>{assignment.pdfFileName}</span>
                                </div>
                              )}
                              {assignment.dueDate && (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              {assignment.submittedAt && (
                                <div className="flex items-center gap-2 text-green-600">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  <span>Submitted: {new Date(assignment.submittedAt).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button className="ml-4 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200">
                            {assignment.submitted ? "View Submission" : "Submit Assignment"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

