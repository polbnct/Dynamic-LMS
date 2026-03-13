"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { getAssignments, getAssignmentSubmissions, getAssignmentPDFUrl, submitAssignment } from "@/lib/supabase/queries/assignments";
import type { Assignment } from "@/lib/supabase/queries/assignments";

interface AssignmentWithUI extends Assignment {
  pdfUrl?: string;
  pdfFileName?: string;
  createdAt: string;
  dueDate?: string;
  submitted?: boolean;
  submittedAt?: string;
  submissionCount?: number;
  maxSubmissions?: number | null;
}

export default function StudentAssignmentsPage() {
  const params = useParams();
  const rawId = params.id as string | undefined;
  const courseId = typeof rawId === "string" && rawId !== "undefined" ? rawId : "";

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<AssignmentWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithUI | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [assignmentForDetails, setAssignmentForDetails] = useState<AssignmentWithUI | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSubmissionFile(e.target.files[0]);
      setSubmitError("");
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment || !submissionFile) {
      setSubmitError("Please select a file to submit.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const studentId = await getCurrentStudentId();
      if (!studentId) {
        throw new Error("Student not found");
      }

      await submitAssignment(selectedAssignment.id, studentId, submissionFile);

      // Refresh assignments and submissions
      const [assignmentsData] = await Promise.all([getAssignments(courseId)]);
      const assignmentIds = assignmentsData.map((a) => a.id);
      const submissions = await getAssignmentSubmissions(studentId, assignmentIds);

      const submissionsByAssignment = new Map<
        string,
        { latest: (typeof submissions)[number]; count: number }
      >();

      submissions.forEach((s) => {
        const existing = submissionsByAssignment.get(s.assignment_id);
        if (!existing) {
          submissionsByAssignment.set(s.assignment_id, { latest: s, count: 1 });
        } else {
          const isLater =
            new Date(s.submitted_at).getTime() >
            new Date(existing.latest.submitted_at).getTime();
          submissionsByAssignment.set(s.assignment_id, {
            latest: isLater ? s : existing.latest,
            count: existing.count + 1,
          });
        }
      });

      setAssignments(
        assignmentsData.map((assignment) => {
          const entry = submissionsByAssignment.get(assignment.id);
          const latest = entry?.latest;
          const count = entry?.count ?? 0;
          return {
            ...assignment,
            pdfUrl: assignment.pdf_file_path
              ? getAssignmentPDFUrl(assignment.pdf_file_path)
              : undefined,
            pdfFileName: assignment.pdf_file_path
              ? assignment.pdf_file_path.split("/").pop()
              : undefined,
            createdAt: assignment.created_at,
            dueDate: assignment.due_date,
            submitted: count > 0,
            submittedAt: latest?.submitted_at,
            submissionCount: count,
            maxSubmissions: assignment.max_submissions ?? null,
          };
        })
      );

      setSubmitSuccess("Assignment submitted successfully!");
      setTimeout(() => {
        setSubmitModalOpen(false);
        setSelectedAssignment(null);
        setSubmissionFile(null);
        setSubmitSuccess("");
      }, 1500);
    } catch (err: any) {
      console.error("Error submitting assignment:", err);
      setSubmitError(err.message || "Failed to submit assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    async function fetchCourse() {
      if (!courseId) {
        console.error("StudentAssignmentsPage: invalid course id from route params", rawId);
        setLoading(false);
        return;
      }
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        
        const [assignmentsData, studentId] = await Promise.all([
          getAssignments(courseId),
          getCurrentStudentId(),
        ]);

        if (!studentId) {
          throw new Error("Student not found");
        }

        const assignmentIds = assignmentsData.map((a) => a.id);
        const submissions = await getAssignmentSubmissions(studentId, assignmentIds);

        const submissionsByAssignment = new Map<
          string,
          { latest: (typeof submissions)[number]; count: number }
        >();

        submissions.forEach((s) => {
          const existing = submissionsByAssignment.get(s.assignment_id);
          if (!existing) {
            submissionsByAssignment.set(s.assignment_id, { latest: s, count: 1 });
          } else {
            const isLater =
              new Date(s.submitted_at).getTime() >
              new Date(existing.latest.submitted_at).getTime();
            submissionsByAssignment.set(s.assignment_id, {
              latest: isLater ? s : existing.latest,
              count: existing.count + 1,
            });
          }
        });

        setAssignments(
          assignmentsData.map((assignment) => {
            const entry = submissionsByAssignment.get(assignment.id);
            const latest = entry?.latest;
            const count = entry?.count ?? 0;
            return {
              ...assignment,
              pdfUrl: assignment.pdf_file_path
                ? getAssignmentPDFUrl(assignment.pdf_file_path)
                : undefined,
              pdfFileName: assignment.pdf_file_path
                ? assignment.pdf_file_path.split("/").pop()
                : undefined,
              createdAt: assignment.created_at,
              dueDate: assignment.due_date,
              submitted: count > 0,
              submittedAt: latest?.submitted_at,
              submissionCount: count,
              maxSubmissions: assignment.max_submissions ?? null,
            };
          })
        );
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId, rawId]);

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
            href="/student/dashboard"
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
                    {categoryAssignments.map((assignment) => {
                      const maxSubs = assignment.maxSubmissions ?? null;
                      const submissionCount = assignment.submissionCount ?? 0;
                      const hasLimit = maxSubs != null;
                      const canSubmitMore = !hasLimit || submissionCount < maxSubs;

                      return (
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
                              {assignment.pdfUrl ? (
                                <a
                                  href={assignment.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  View PDF {assignment.pdfFileName && `(${assignment.pdfFileName})`}
                                </a>
                              ) : assignment.pdfFileName ? (
                                <span className="flex items-center gap-2 text-gray-600">{assignment.pdfFileName}</span>
                              ) : null}
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
                                  <span>
                                    Due (PH time):{" "}
                                    {new Date(assignment.dueDate).toLocaleString("en-PH", {
                                      timeZone: "Asia/Manila",
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
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
                                  <span>
                                    Submitted:{" "}
                                    {new Date(assignment.submittedAt).toLocaleString("en-PH", {
                                      timeZone: "Asia/Manila",
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </div>
                              )}
                              {hasLimit && (
                                <div className="flex items-center gap-2 text-gray-500">
                                  <span>
                                    Submissions used: {submissionCount} / {maxSubs}
                                  </span>
                                </div>
                              )}
                              {!hasLimit && submissionCount > 0 && (
                                <div className="flex items-center gap-2 text-gray-500">
                                  <span>Submissions so far: {submissionCount}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4 flex items-center gap-3">
                            <button
                              onClick={() => {
                                setAssignmentForDetails(assignment);
                                setDetailsModalOpen(true);
                              }}
                              className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-all duration-200"
                            >
                              View details
                            </button>
                            <button
                              onClick={() => {
                                if (canSubmitMore) {
                                  setSelectedAssignment(assignment);
                                  setSubmitModalOpen(true);
                                } else {
                                  setSubmitError(
                                    "You have reached the maximum number of submissions allowed for this assignment."
                                  );
                                }
                              }}
                              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                            >
                              {canSubmitMore
                                ? assignment.submitted
                                  ? "Submit again"
                                  : "Submit Assignment"
                                : "Submission limit reached"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Assignment Details Modal */}
      {detailsModalOpen && assignmentForDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Assignment details</h2>
              <button
                onClick={() => { setDetailsModalOpen(false); setAssignmentForDetails(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Title</p>
                <p className="text-lg font-semibold text-gray-800 mt-1">{assignmentForDetails.title}</p>
              </div>
              {assignmentForDetails.description && (
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Description</p>
                  <p className="text-gray-700 mt-1 whitespace-pre-wrap">{assignmentForDetails.description}</p>
                </div>
              )}
              {assignmentForDetails.dueDate && (
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Due date</p>
                  <p className="text-gray-700 mt-1">{new Date(assignmentForDetails.dueDate).toLocaleDateString()}</p>
                </div>
              )}
              {assignmentForDetails.pdfUrl && (
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Attached PDF</p>
                  <a
                    href={assignmentForDetails.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    View PDF {assignmentForDetails.pdfFileName && `(${assignmentForDetails.pdfFileName})`}
                  </a>
                </div>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => { setDetailsModalOpen(false); setAssignmentForDetails(null); }}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Assignment Modal */}
      {submitModalOpen && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Submit Assignment
              </h2>
              <button
                onClick={() => {
                  setSubmitModalOpen(false);
                  setSelectedAssignment(null);
                  setSubmissionFile(null);
                  setSubmitError("");
                  setSubmitSuccess("");
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Assignment: <span className="font-semibold">{selectedAssignment.title}</span></p>
                {selectedAssignment.dueDate && (
                  <p className="text-xs text-gray-500">Due: {new Date(selectedAssignment.dueDate).toLocaleDateString()}</p>
                )}
              </div>

              <div>
                <label htmlFor="submissionFile" className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload File
                </label>
                <input
                  id="submissionFile"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {submissionFile && (
                  <p className="mt-2 text-sm text-gray-600">{submissionFile.name}</p>
                )}
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                  {submitSuccess}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitModalOpen(false);
                    setSelectedAssignment(null);
                    setSubmissionFile(null);
                    setSubmitError("");
                    setSubmitSuccess("");
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAssignment}
                  disabled={submitting || !submissionFile}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

