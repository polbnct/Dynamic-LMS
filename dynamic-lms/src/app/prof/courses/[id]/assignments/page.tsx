"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import CourseNavbar from "@/utils/CourseNavbar";
import { getCourseById } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { getAssignments, createAssignment, updateAssignment, deleteAssignment, uploadAssignmentPDF, getAssignmentPDFUrl, getSubmissionFileUrl, getSubmissionsByAssignmentId, updateAssignmentSubmission } from "@/lib/supabase/queries/assignments";
import type { Assignment, SubmissionWithStudent } from "@/lib/supabase/queries/assignments";

type AssignmentWithUI = Assignment & {
  pdfUrl?: string;
  pdfFileName?: string;
  createdAt?: string;
  dueDate?: string;
};

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function manilaInputToUtcIso(input: string): string | null {
  if (!input) return null;
  const [datePart, timePart] = input.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map((x) => parseInt(x, 10));
  const [hour, minute] = timePart.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  const manilaMs = Date.UTC(year, month - 1, day, hour, minute);
  const utcMs = manilaMs - MANILA_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

function utcIsoToManilaInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const manilaMs = d.getTime() + MANILA_OFFSET_MS;
  const manila = new Date(manilaMs);
  const yyyy = manila.getUTCFullYear();
  const mm = String(manila.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(manila.getUTCDate()).padStart(2, "0");
  const hh = String(manila.getUTCHours()).padStart(2, "0");
  const mi = String(manila.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function AssignmentsPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<AssignmentWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [createAssignmentModalOpen, setCreateAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentWithUI | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "prelim" as "prelim" | "midterm" | "finals",
    dueDate: "",
    maxSubmissions: "1" as string, // "unlimited" or a positive integer string
  });
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "prelim" as "prelim" | "midterm" | "finals",
    dueDate: "",
    pdfFile: null as File | null,
    maxSubmissions: "1" as string, // "unlimited" or a positive integer string
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [submissionsModalOpen, setSubmissionsModalOpen] = useState(false);
  const [assignmentForSubmissions, setAssignmentForSubmissions] = useState<AssignmentWithUI | null>(null);
  const [submissionsList, setSubmissionsList] = useState<SubmissionWithStudent[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithStudent | null>(null);
  const [gradeForm, setGradeForm] = useState({ score: "", max_score: "", feedback: "" });
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeSuccess, setGradeSuccess] = useState("");
  const { handledCourses, createCourse } = useProfessorCourses();

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        const assignmentsData = await getAssignments(courseId);
        setAssignments(
          assignmentsData.map((assignment) => ({
            ...assignment,
            pdfUrl: assignment.pdf_file_path ? getAssignmentPDFUrl(assignment.pdf_file_path) : undefined,
            pdfFileName: assignment.pdf_file_path ? assignment.pdf_file_path.split("/").pop() : undefined,
            createdAt: assignment.created_at,
            dueDate: assignment.due_date,
          }))
        );
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file.");
        return;
      }
      setFormData({ ...formData, pdfFile: file });
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.title.trim()) {
      setError("Please enter an assignment name.");
      return;
    }

    try {
      // Create assignment in database first so we have a real ID for the PDF path
      const maxSubmissionsValue =
        formData.maxSubmissions === "unlimited" ? null : Number(formData.maxSubmissions) || null;

      const newAssignment = await createAssignment(courseId, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        due_date: formData.dueDate ? manilaInputToUtcIso(formData.dueDate) ?? undefined : undefined,
        max_submissions: maxSubmissionsValue ?? undefined,
      });

      let pdfPath: string | undefined;
      if (formData.pdfFile) {
        pdfPath = await uploadAssignmentPDF(formData.pdfFile, courseId, newAssignment.id);
        await updateAssignment(newAssignment.id, { pdf_file_path: pdfPath });
      }

      // Add to local state (use updated assignment with pdf path if we uploaded)
      const assignmentToAdd = pdfPath
        ? {
            ...newAssignment,
            pdf_file_path: pdfPath,
            pdfUrl: getAssignmentPDFUrl(pdfPath),
            pdfFileName: formData.pdfFile!.name,
            createdAt: newAssignment.created_at,
            dueDate: newAssignment.due_date,
          }
        : {
            ...newAssignment,
            pdfUrl: undefined,
            pdfFileName: undefined,
            createdAt: newAssignment.created_at,
            dueDate: newAssignment.due_date,
          };
      setAssignments([...assignments, assignmentToAdd as any]);

      setSuccess("Assignment created successfully!");

      // Reset form
      setFormData({
        title: "",
        description: "",
        category: "prelim",
        dueDate: "",
        pdfFile: null,
        maxSubmissions: "1",
      });

      // Close modal after a short delay
      setTimeout(() => {
        setCreateAssignmentModalOpen(false);
        setSuccess("");
      }, 1000);
    } catch (err: any) {
      console.error("Error creating assignment:", err);
      setError(err.message || "Failed to create assignment. Please try again.");
    }
  };

  const handleCancel = () => {
    setCreateAssignmentModalOpen(false);
    setFormData({
      title: "",
      description: "",
      category: "prelim",
      dueDate: "",
      pdfFile: null,
      maxSubmissions: "1",
    });
    setError("");
    setSuccess("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const maxSubmissionsValue =
        editForm.maxSubmissions === "unlimited" ? null : Number(editForm.maxSubmissions) || null;

      const updated = await updateAssignment(editingAssignment.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        category: editForm.category,
        due_date: editForm.dueDate ? manilaInputToUtcIso(editForm.dueDate) ?? undefined : undefined,
        max_submissions: maxSubmissionsValue ?? undefined,
      });
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === updated.id
            ? {
                ...a,
                ...updated,
                pdfUrl: updated.pdf_file_path ? getAssignmentPDFUrl(updated.pdf_file_path) : (a as any).pdfUrl,
                pdfFileName: updated.pdf_file_path ? updated.pdf_file_path.split("/").pop() : (a as any).pdfFileName,
                dueDate: updated.due_date,
              }
            : a
        )
      );
      setSuccess("Assignment updated.");
      setTimeout(() => setSuccess(""), 3000);
      setEditingAssignment(null);
    } catch (err: any) {
      setError(err.message || "Failed to update assignment.");
    } finally {
      setSaving(false);
    }
  };

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
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} onCreateCourse={createCourse} />
        <CourseNavbar courseId={courseId} currentPage="assignments" />
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
      {/* Professor Navbar */}
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} onCreateCourse={createCourse} />

      {/* Course Navbar */}
      <CourseNavbar
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Assignments
              </h1>
              <p className="text-gray-600">
                {course?.name} ({course?.code}) • {totalAssignments} assignment{totalAssignments !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => setCreateAssignmentModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Assignment
            </button>
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
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No assignments yet</h3>
              <p className="text-gray-600">Use the "Create Assignment" button above to get started</p>
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

                  {/* Assignments in Category */}
                  <div className="space-y-4">
                    {categoryAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-800 mb-2">{assignment.title}</h3>
                              {assignment.description && (
                                <p className="text-gray-600 mb-3">{assignment.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                                {assignment.pdfUrl && (
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
                                )}
                                {assignment.createdAt && (
                                  <span>
                                    Created: {new Date(assignment.createdAt).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                setAssignmentForSubmissions(assignment);
                                setSubmissionsModalOpen(true);
                                setSubmissionsLoading(true);
                                try {
                                  const list = await getSubmissionsByAssignmentId(assignment.id);
                                  setSubmissionsList(list);
                                } catch (err: any) {
                                  setError(err.message || "Failed to load submissions.");
                                } finally {
                                  setSubmissionsLoading(false);
                                }
                              }}
                              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="View student submissions"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          <button
                              onClick={() => {
                                setEditingAssignment(assignment);
                                setEditForm({
                                  title: assignment.title,
                                  description: assignment.description ?? "",
                                  category: assignment.category,
                                  dueDate: assignment.dueDate ? utcIsoToManilaInput(assignment.dueDate) : "",
                                  maxSubmissions:
                                    assignment.max_submissions == null
                                      ? "unlimited"
                                      : String(assignment.max_submissions),
                                });
                              }}
                              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit assignment"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete assignment "${assignment.title}"? This cannot be undone.`)) return;
                                try {
                                  await deleteAssignment(assignment.id);
                                  setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
                                  setSuccess("Assignment deleted.");
                                  setTimeout(() => setSuccess(""), 3000);
                                } catch (err: any) {
                                  setError(err.message || "Failed to delete.");
                                }
                              }}
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete assignment"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
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

      {/* Create Assignment Modal */}
      {createAssignmentModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCancel}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 transform transition-all max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Create Assignment
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Assignment Name */}
                <div>
                  <label htmlFor="assignmentName" className="block text-sm font-semibold text-gray-700 mb-2">
                    Assignment Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <input
                      id="assignmentName"
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter assignment name"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Description (Optional Text) */}
                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                    Description <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <div className="relative">
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Write assignment description or instructions..."
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white resize-none"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Provide details, instructions, or requirements for this assignment</p>
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                    </div>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value as "prelim" | "midterm" | "finals" })
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white appearance-none cursor-pointer"
                    >
                      <option value="prelim">Prelim</option>
                      <option value="midterm">Midterm</option>
                      <option value="finals">Finals</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Due Date (Optional, PH time) */}
                <div>
                  <label htmlFor="dueDate" className="block text-sm font-semibold text-gray-700 mb-2">
                    Due date &amp; time (PH) <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    id="dueDate"
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Interpreted as Philippine time (Asia/Manila) when saving.
                  </p>
                </div>

                {/* Max submissions per student */}
                <div>
                  <label htmlFor="maxSubmissions" className="block text-sm font-semibold text-gray-700 mb-2">
                    Max submissions per student
                  </label>
                  <select
                    id="maxSubmissions"
                    value={formData.maxSubmissions}
                    onChange={(e) => setFormData({ ...formData, maxSubmissions: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 focus:bg-white appearance-none cursor-pointer"
                  >
                    <option value="1">1 (single submission)</option>
                    <option value="2">2 submissions</option>
                    <option value="3">3 submissions</option>
                    <option value="5">5 submissions</option>
                    <option value="10">10 submissions</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Students will be stopped from submitting again after they reach this limit. Choose{" "}
                    <span className="font-semibold">Unlimited</span> to allow any number of submissions.
                  </p>
                </div>

                {/* PDF Upload (Optional) */}
                <div>
                  <label htmlFor="pdfFile" className="block text-sm font-semibold text-gray-700 mb-2">
                    PDF File <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="pdfFile"
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                  {formData.pdfFile && (
                    <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {formData.pdfFile.name}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Upload a PDF file if needed (e.g., assignment template, rubric)</p>
                </div>

                {/* Error Message */}
                {error && (
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
                    {error}
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-green-600 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {success}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Create Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Edit Assignment
              </h2>
              <button
                onClick={() => { setEditingAssignment(null); setError(""); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assignment Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Enter assignment name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Assignment description..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 focus:bg-white resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as "prelim" | "midterm" | "finals" })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 focus:bg-white"
                >
                  <option value="prelim">Prelim</option>
                  <option value="midterm">Midterm</option>
                  <option value="finals">Finals</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Due date &amp; time (PH, optional)
                </label>
                <input
                  type="datetime-local"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Max submissions per student
                </label>
                <select
                  value={editForm.maxSubmissions}
                  onChange={(e) => setEditForm({ ...editForm, maxSubmissions: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 focus:bg-white"
                >
                  <option value="1">1 (single submission)</option>
                  <option value="2">2 submissions</option>
                  <option value="3">3 submissions</option>
                  <option value="5">5 submissions</option>
                  <option value="10">10 submissions</option>
                  <option value="unlimited">Unlimited</option>
                </select>
              </div>
              {editingAssignment.pdfUrl && (
                <p className="text-sm text-gray-600">
                  Attached PDF:{" "}
                  <a href={editingAssignment.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    View current PDF
                  </a>
                </p>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setEditingAssignment(null); setError(""); }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Student Submissions Modal - large view + grade */}
      {submissionsModalOpen && assignmentForSubmissions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl min-h-[85vh] max-h-[95vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Student submissions</h2>
                <p className="text-gray-600 text-sm mt-0.5">{assignmentForSubmissions.title}</p>
              </div>
              <button
                onClick={() => {
                  setSubmissionsModalOpen(false);
                  setAssignmentForSubmissions(null);
                  setSubmissionsList([]);
                  setSelectedSubmission(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 flex min-h-0">
              {submissionsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent"></div>
                </div>
              ) : submissionsList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <p className="text-gray-600">No submissions yet for this assignment.</p>
                </div>
              ) : (
                <>
                  {/* Left: list of submissions */}
                  <div className="w-72 shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50/50">
                    <div className="p-3 space-y-2">
                      {submissionsList.map((sub) => {
                        const isSelected = selectedSubmission?.id === sub.id;
                        const isGraded = sub.graded_at != null;
                        const maxScore = sub.max_score ?? 100;
                        const score = sub.score ?? 0;
                        const passed = isGraded && maxScore > 0 && score / maxScore >= 0.6;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setSelectedSubmission(sub);
                              setGradeForm({
                                score: sub.score != null ? String(sub.score) : "",
                                max_score: sub.max_score != null ? String(sub.max_score) : "100",
                                feedback: sub.feedback ?? "",
                              });
                            }}
                            className={`w-full text-left rounded-xl p-3 border transition-colors ${
                              isSelected
                                ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                                : "bg-white border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <p className="font-semibold text-gray-800 truncate">{sub.studentName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(sub.submitted_at).toLocaleDateString()}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {isGraded ? (
                                <>
                                  <span
                                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                      passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {passed ? "Passed" : "Failed"}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {score}/{maxScore}
                                  </span>
                                </>
                              ) : (
                                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                                  Not graded
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: file viewer + grading */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {selectedSubmission ? (
                      <>
                        {/* Embedded file viewer */}
                        <div className="flex-1 min-h-[280px] border-b border-gray-200 bg-gray-100">
                          {selectedSubmission.fileUrl ? (
                            <iframe
                              src={selectedSubmission.fileUrl}
                              title={`Submission by ${selectedSubmission.studentName}`}
                              className="w-full h-full min-h-[280px]"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                              No file to display.{" "}
                              {selectedSubmission.file_path && (
                                <a
                                  href={getSubmissionFileUrl(selectedSubmission.file_path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:underline ml-1"
                                >
                                  Open in new tab
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Grading form */}
                        <div className="shrink-0 p-4 bg-white border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-700 mb-3">
                            Grade: {selectedSubmission.studentName}
                          </p>
                          <div className="flex flex-wrap gap-4 items-end">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Score</label>
                              <input
                                type="number"
                                min={0}
                                value={gradeForm.score}
                                onChange={(e) => setGradeForm((f) => ({ ...f, score: e.target.value }))}
                                placeholder="0"
                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Out of</label>
                              <input
                                type="number"
                                min={1}
                                value={gradeForm.max_score}
                                onChange={(e) => setGradeForm((f) => ({ ...f, max_score: e.target.value }))}
                                placeholder="100"
                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Feedback (optional)</label>
                              <input
                                type="text"
                                value={gradeForm.feedback}
                                onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))}
                                placeholder="Optional feedback for student"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={savingGrade || gradeForm.score === "" || gradeForm.max_score === ""}
                              onClick={async () => {
                                const score = parseInt(gradeForm.score, 10);
                                const max_score = parseInt(gradeForm.max_score, 10);
                                if (isNaN(score) || isNaN(max_score) || max_score < 1) return;
                                setSavingGrade(true);
                                setGradeSuccess("");
                                try {
                                  await updateAssignmentSubmission(selectedSubmission.id, {
                                    score,
                                    max_score,
                                    feedback: gradeForm.feedback.trim() || undefined,
                                  });
                                  setSubmissionsList((prev) =>
                                    prev.map((s) =>
                                      s.id === selectedSubmission.id
                                        ? {
                                            ...s,
                                            score,
                                            max_score,
                                            feedback: gradeForm.feedback.trim() || undefined,
                                            graded_at: new Date().toISOString(),
                                          }
                                        : s
                                    )
                                  );
                                  setSelectedSubmission((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          score,
                                          max_score,
                                          feedback: gradeForm.feedback.trim() || undefined,
                                          graded_at: new Date().toISOString(),
                                        }
                                      : null
                                  );
                                  setGradeSuccess("Grade saved. It will appear in the Grades tab for this student.");
                                  setTimeout(() => setGradeSuccess(""), 4000);
                                } catch (err: any) {
                                  setError(err.message || "Failed to save grade.");
                                } finally {
                                  setSavingGrade(false);
                                }
                              }}
                              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingGrade ? "Saving..." : "Save grade"}
                            </button>
                          </div>
                          {gradeSuccess && (
                            <p className="mt-2 text-sm text-green-600">{gradeSuccess}</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-gray-500 p-8">
                        Select a submission from the list to view the file and grade it.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600 shrink-0">
              {!submissionsLoading && submissionsList.length > 0 && (
                <span>{submissionsList.length} submission{submissionsList.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
