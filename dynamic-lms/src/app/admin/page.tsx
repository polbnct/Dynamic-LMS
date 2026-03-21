"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AdminCourse = {
  id: string;
  name: string;
  code: string;
  professor_id: string | null;
  professorName: string | null;
  created_at: string;
  studentsCount: number;
};

type AdminProfessor = {
  id: string;
  user_id: string;
  name: string;
  email: string;
};

type AdminStudent = {
  id: string;
  user_id: string;
  student_id: string;
  name: string;
  email: string;
};

type AdminEnrollment = {
  id: string;
  enrolled_at: string;
  course_id: string;
  student: {
    studentDbId: string;
    authUserId: string;
    studentId: string;
    name: string;
    email: string;
  } | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

function generateCourseCode(): string {
  return `CS${Math.floor(Math.random() * 900) + 100}`;
}

function generateInviteCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  code += String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return code;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"courses" | "professors" | "students">("courses");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [professors, setProfessors] = useState<AdminProfessor[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [deletingProfessorId, setDeletingProfessorId] = useState<string | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);

  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [createCourseForm, setCreateCourseForm] = useState({
    name: "",
    code: "",
    professor_id: "",
  });

  const [manageCourse, setManageCourse] = useState<AdminCourse | null>(null);
  const [manageEnrollments, setManageEnrollments] = useState<AdminEnrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [addingEnrollment, setAddingEnrollment] = useState(false);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState("");
  const [editCourseForm, setEditCourseForm] = useState({ name: "", code: "" });
  const [savingCourse, setSavingCourse] = useState(false);

  const [manageAccountOpen, setManageAccountOpen] = useState(false);
  const [manageAccountUser, setManageAccountUser] = useState<{
    userId: string;
    name: string;
    email: string;
    kind: "professor" | "student";
  } | null>(null);
  const [manageName, setManageName] = useState("");
  const [manageEmail, setManageEmail] = useState("");
  const [managePassword, setManagePassword] = useState("");
  const [managePasswordConfirm, setManagePasswordConfirm] = useState("");
  const [manageAccountSaving, setManageAccountSaving] = useState(false);
  const [manageAccountError, setManageAccountError] = useState("");
  const [manageAccountSuccess, setManageAccountSuccess] = useState("");

  const professorOptions = useMemo(() => professors.slice().sort((a, b) => a.name.localeCompare(b.name)), [professors]);
  const studentOptions = useMemo(() => students.slice().sort((a, b) => a.name.localeCompare(b.name)), [students]);

  const openManageAccount = (u: { userId: string; name: string; email: string; kind: "professor" | "student" }) => {
    setManageAccountUser(u);
    setManageName(u.name || "");
    setManageEmail(u.email || "");
    setManagePassword("");
    setManagePasswordConfirm("");
    setManageAccountError("");
    setManageAccountSuccess("");
    setManageAccountOpen(true);
  };

  const closeManageAccount = () => {
    if (manageAccountSaving) return;
    setManageAccountOpen(false);
    setManageAccountUser(null);
    setManageName("");
    setManageEmail("");
    setManagePassword("");
    setManagePasswordConfirm("");
    setManageAccountError("");
    setManageAccountSuccess("");
  };

  const handleAdminManageAccountSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageAccountUser || manageAccountSaving) return;
    setManageAccountError("");
    setManageAccountSuccess("");

    const name = manageName.trim();
    const email = manageEmail.trim().toLowerCase().replace(/\s+/g, "");
    if (!name) {
      setManageAccountError("Name is required.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setManageAccountError("Please enter a valid email address.");
      return;
    }

    const password = managePassword;
    const wantsPasswordChange = password.trim().length > 0;
    if (wantsPasswordChange) {
      if (password.trim().length < 8) {
        setManageAccountError("Password must be at least 8 characters long.");
        return;
      }
      if (password !== managePasswordConfirm) {
        setManageAccountError("Passwords do not match.");
        return;
      }
    }

    setManageAccountSaving(true);
    try {
      // Update Auth user + public.users profile (name/email).
      await fetchJson<{ ok: true; user: { id: string; name: string; email: string } }>(
        `/api/admin/users/${encodeURIComponent(manageAccountUser.userId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name, email }),
        }
      );

      // Optional: update password.
      if (wantsPasswordChange) {
        await fetchJson<{ ok: true }>(
          `/api/admin/users/${encodeURIComponent(manageAccountUser.userId)}/password`,
          {
            method: "PATCH",
            body: JSON.stringify({ password }),
          }
        );
      }

      // Update local UI lists to reflect changes immediately.
      setProfessors((prev) =>
        prev.map((p) => (p.user_id === manageAccountUser.userId ? { ...p, name, email } : p))
      );
      setStudents((prev) =>
        prev.map((s) => (s.user_id === manageAccountUser.userId ? { ...s, name, email } : s))
      );

      setManageAccountUser((prev) => (prev ? { ...prev, name, email } : prev));
      setManageAccountSuccess(wantsPasswordChange ? "Account updated (name, email, password)." : "Account updated (name, email).");
      setManagePassword("");
      setManagePasswordConfirm("");
    } catch (e: any) {
      setManageAccountError(e?.message || "Failed to update account.");
    } finally {
      setManageAccountSaving(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [coursesRes, profRes, studRes] = await Promise.all([
        fetchJson<{ courses: AdminCourse[] }>("/api/admin/courses"),
        fetchJson<{ professors: AdminProfessor[] }>("/api/admin/professors"),
        fetchJson<{ students: AdminStudent[] }>("/api/admin/students"),
      ]);
      setCourses(coursesRes.courses || []);
      setProfessors(profRes.professors || []);
      setStudents(studRes.students || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const openCreateCourse = () => {
    setError("");
    setSuccess("");
    setCreateCourseForm({
      name: "",
      code: generateCourseCode(),
      professor_id: "",
    });
    setCreateCourseOpen(true);
  };

  const closeCreateCourse = () => {
    if (creatingCourse) return;
    setCreateCourseOpen(false);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!createCourseForm.name.trim()) {
      setError("Course name is required.");
      return;
    }
    if (!createCourseForm.code.trim()) {
      setError("Course code is required.");
      return;
    }

    setCreatingCourse(true);
    try {
      await fetchJson<{ course: AdminCourse }>("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          name: createCourseForm.name.trim(),
          code: createCourseForm.code.trim(),
          professor_id: createCourseForm.professor_id.trim() || null,
        }),
      });
      setSuccess("Course created.");
      setCreateCourseOpen(false);
      await refreshAll();
    } catch (e: any) {
      setError(e?.message || "Failed to create course.");
    } finally {
      setCreatingCourse(false);
    }
  };

  const openManageCourse = async (course: AdminCourse) => {
    setManageCourse(course);
    setEditCourseForm({ name: course.name, code: course.code });
    setManageEnrollments([]);
    setError("");
    setSuccess("");
    setLoadingEnrollments(true);
    try {
      const res = await fetchJson<{ enrollments: AdminEnrollment[] }>(
        `/api/admin/courses/${encodeURIComponent(course.id)}/enrollments`
      );
      setManageEnrollments(res.enrollments || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load enrollments.");
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const closeManageCourse = () => {
    if (loadingEnrollments || addingEnrollment) return;
    setManageCourse(null);
    setManageEnrollments([]);
    setSelectedStudentToAdd("");
    setEditCourseForm({ name: "", code: "" });
  };

  const handleAssignProfessor = async (professorId: string) => {
    if (!manageCourse) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetchJson<{ course: AdminCourse }>(`/api/admin/courses/${manageCourse.id}`, {
        method: "PATCH",
        body: JSON.stringify({ professor_id: professorId || null }),
      });
      setSuccess("Course owner updated.");
      setCourses((prev) => prev.map((c) => (c.id === manageCourse.id ? { ...c, ...res.course } : c)));
      setManageCourse((prev) => (prev ? { ...prev, ...res.course } : prev));
      await refreshAll();
    } catch (e: any) {
      setError(e?.message || "Failed to update course.");
    }
  };

  const handleSaveCourseDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageCourse) return;
    const name = editCourseForm.name.trim();
    const code = editCourseForm.code.trim();
    if (!name) {
      setError("Course name is required.");
      return;
    }
    if (!code) {
      setError("Course code is required.");
      return;
    }
    setError("");
    setSuccess("");
    setSavingCourse(true);
    try {
      const res = await fetchJson<{ course: AdminCourse }>(`/api/admin/courses/${manageCourse.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, code }),
      });
      setSuccess("Course details updated.");
      setCourses((prev) => prev.map((c) => (c.id === manageCourse.id ? { ...c, ...res.course } : c)));
      setManageCourse((prev) => (prev ? { ...prev, ...res.course } : prev));
    } catch (e: any) {
      setError(e?.message || "Failed to update course.");
    } finally {
      setSavingCourse(false);
    }
  };

  const handleAddStudentToCourse = async () => {
    if (!manageCourse) return;
    const studentDbId = selectedStudentToAdd.trim();
    if (!studentDbId) return;

    setError("");
    setSuccess("");
    setAddingEnrollment(true);
    try {
      await fetchJson<{ enrollment: { id: string } }>(
        `/api/admin/courses/${encodeURIComponent(manageCourse.id)}/enrollments/add`,
        {
          method: "POST",
          body: JSON.stringify({ studentDbId }),
        }
      );

      // reload enrollments to get student info
      const res = await fetchJson<{ enrollments: AdminEnrollment[] }>(
        `/api/admin/courses/${encodeURIComponent(manageCourse.id)}/enrollments`
      );
      setManageEnrollments(res.enrollments || []);
      setSelectedStudentToAdd("");
      setSuccess("Student added to course.");
      setCourses((prev) => prev.map((c) => (c.id === manageCourse.id ? { ...c, studentsCount: (c.studentsCount || 0) + 1 } : c)));
    } catch (e: any) {
      setError(e?.message || "Failed to add student.");
    } finally {
      setAddingEnrollment(false);
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!manageCourse) return;
    setError("");
    setSuccess("");
    try {
      await fetchJson<{ ok: true }>(`/api/admin/enrollments/${encodeURIComponent(enrollmentId)}`, { method: "DELETE" });
      setManageEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
      setSuccess("Student removed from course.");
      setCourses((prev) =>
        prev.map((c) => (c.id === manageCourse.id ? { ...c, studentsCount: Math.max(0, (c.studentsCount || 0) - 1) } : c))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to remove student.");
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Keep UI simple; just log and stay on page
        console.error("Admin logout error:", error);
      }
    } finally {
      router.push("/login");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!courseId) return;
    const course = courses.find((c) => c.id === courseId);
    if (
      !course ||
      !confirm(
        `Delete course "${course.name}"? This will remove lessons, assignments, quizzes, enrollments, and cannot be undone.`
      )
    ) {
      return;
    }
    setError("");
    setSuccess("");
    setDeletingCourseId(courseId);
    try {
      await fetchJson<{ ok: true }>(`/api/admin/courses/${encodeURIComponent(courseId)}`, {
        method: "DELETE",
      });
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      setSuccess("Course deleted.");
    } catch (e: any) {
      setError(e?.message || "Failed to delete course.");
    } finally {
      setDeletingCourseId(null);
    }
  };

  const handleDeleteProfessor = async (professorId: string) => {
    if (!professorId) return;
    const prof = professors.find((p) => p.id === professorId);
    if (
      !prof ||
      !confirm(
        `Delete professor account "${prof.name}" (${prof.email})? This will remove their auth account and related data.`
      )
    ) {
      return;
    }
    setError("");
    setSuccess("");
    setDeletingProfessorId(professorId);
    try {
      await fetchJson<{ ok: true }>(`/api/admin/professors/${encodeURIComponent(professorId)}`, {
        method: "DELETE",
      });
      setProfessors((prev) => prev.filter((p) => p.id !== professorId));
      setCourses((prev) =>
        prev.map((c) => (c.professor_id === professorId ? { ...c, professor_id: null, professorName: null } : c))
      );
      setSuccess("Professor account deleted.");
    } catch (e: any) {
      setError(e?.message || "Failed to delete professor account.");
    } finally {
      setDeletingProfessorId(null);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!studentId) return;
    const s = students.find((st) => st.id === studentId);
    if (
      !s ||
      !confirm(
        `Delete student account "${s.name}" (${s.email})? This will remove their auth account and related data.`
      )
    ) {
      return;
    }
    setError("");
    setSuccess("");
    setDeletingStudentId(studentId);
    try {
      await fetchJson<{ ok: true }>(`/api/admin/students/${encodeURIComponent(studentId)}`, {
        method: "DELETE",
      });
      setStudents((prev) => prev.filter((st) => st.id !== studentId));
      // Enrollments in courses are cascaded by FK; we don't reload all courses here.
      setSuccess("Student account deleted.");
    } catch (e: any) {
      setError(e?.message || "Failed to delete student account.");
    } finally {
      setDeletingStudentId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
              Control Center
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Create courses, assign owners, and manage enrollments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateCourse}
              className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold text-sm shadow-sm hover:bg-red-700"
            >
              Create course
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(["courses", "professors", "students"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                activeTab === tab
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab === "courses" ? "Courses" : tab === "professors" ? "Professors" : "Students"}
            </button>
          ))}
        </div>

        {(error || success) && (
          <div className="mt-6 space-y-2">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-red-500" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                <span>{success}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="rounded-3xl border border-rose-100 bg-white p-10 text-center text-gray-500 shadow-sm">
              Loading…
            </div>
          ) : activeTab === "courses" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => openManageCourse(c)}
                      className="text-left flex-1"
                    >
                      <div className="min-w-0">
                        <div className="text-lg font-extrabold truncate text-gray-900">{c.name}</div>
                        <div className="mt-1 text-sm text-gray-600">
                          <span className="font-mono text-gray-800">{c.code}</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Owner: {c.professorName || "Unassigned"} {c.professor_id ? "" : "(no professor)"}
                        </div>
                      </div>
                    </button>
                    <div className="flex flex-col items-end gap-2">
                      <div className="shrink-0 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {c.studentsCount} student{c.studentsCount !== 1 ? "s" : ""}
                      </div>
                      <button
                        type="button"
                        disabled={deletingCourseId === c.id}
                        onClick={() => handleDeleteCourse(c.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingCourseId === c.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {courses.length === 0 && (
                <div className="rounded-3xl border border-dashed border-rose-200 bg-white p-10 text-center text-gray-500 lg:col-span-2">
                  No courses yet.
                </div>
              )}
            </div>
          ) : activeTab === "professors" ? (
            <div className="rounded-3xl border border-rose-100 bg-white overflow-hidden shadow-sm">
              <div className="p-4 border-b border-rose-50 text-sm font-bold text-gray-800">
                Professors ({professors.length})
              </div>
              <div className="divide-y divide-rose-50">
                {professorOptions.map((p) => (
                  <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold truncate text-gray-900">{p.name}</div>
                      <div className="text-sm text-gray-600 truncate">{p.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          openManageAccount({
                            userId: p.user_id,
                            name: p.name,
                            email: p.email,
                            kind: "professor",
                          })
                        }
                        className="text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50"
                      >
                        Manage account
                      </button>
                      <button
                        type="button"
                        disabled={deletingProfessorId === p.id}
                        onClick={() => handleDeleteProfessor(p.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingProfessorId === p.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
                {professors.length === 0 && (
                  <div className="p-10 text-center text-gray-500">No professors found.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-rose-100 bg-white overflow-hidden shadow-sm">
              <div className="p-4 border-b border-rose-50 text-sm font-bold text-gray-800">
                Students ({students.length})
              </div>
              <div className="divide-y divide-rose-50">
                {students.map((s) => (
                  <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold truncate text-gray-900">{s.name}</div>
                      <div className="text-sm text-gray-600 truncate">{s.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 font-mono">
                        {s.student_id}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          openManageAccount({
                            userId: s.user_id,
                            name: s.name,
                            email: s.email,
                            kind: "student",
                          })
                        }
                        className="text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50"
                      >
                        Manage account
                      </button>
                      <button
                        type="button"
                        disabled={deletingStudentId === s.id}
                        onClick={() => handleDeleteStudent(s.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingStudentId === s.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
                {students.length === 0 && (
                  <div className="p-10 text-center text-gray-500">No students found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create course modal */}
      {createCourseOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={closeCreateCourse}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-rose-100 bg-rose-50/40">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xl font-black text-gray-900">Create course</div>
                  <div className="mt-1 text-sm text-gray-600">
                    Create a new course, assign a professor, then enroll students manually.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCreateCourse}
                  className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateCourse} className="p-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700">Course name</label>
                <input
                  value={createCourseForm.name}
                  onChange={(e) => setCreateCourseForm((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-red-400 focus:bg-white"
                  placeholder="e.g. Data Structures"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Course code</label>
                  <input
                    value={createCourseForm.code}
                    onChange={(e) => setCreateCourseForm((p) => ({ ...p, code: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono outline-none focus:border-red-400 focus:bg-white"
                  />
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-gray-600 flex items-center">
                  Invite codes are disabled.
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Assign professor (optional)</label>
                <select
                  value={createCourseForm.professor_id}
                  onChange={(e) => setCreateCourseForm((p) => ({ ...p, professor_id: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-red-400 focus:bg-white"
                >
                  <option value="">Unassigned</option>
                  {professorOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCreateCourseForm((p) => ({
                      ...p,
                      code: generateCourseCode(),
                    }));
                  }}
                  className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  Regenerate code
                </button>
                <button
                  type="submit"
                  disabled={creatingCourse}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                >
                  {creatingCourse ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage account modal */}
      {manageAccountOpen && manageAccountUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={closeManageAccount}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-rose-100 bg-rose-50/40">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xl font-black text-gray-900">Manage account</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {manageAccountUser.kind === "professor" ? "Professor" : "Student"}:{" "}
                    <span className="font-semibold text-gray-900">{manageAccountUser.name}</span>{" "}
                    <span className="text-gray-500">({manageAccountUser.email})</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeManageAccount}
                  className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {manageAccountError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {manageAccountError}
                </div>
              )}
              {manageAccountSuccess && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {manageAccountSuccess}
                </div>
              )}

              <form onSubmit={handleAdminManageAccountSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700">Name</label>
                  <input
                    type="text"
                    value={manageName}
                    onChange={(e) => setManageName(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Email</label>
                  <input
                    type="email"
                    value={manageEmail}
                    onChange={(e) => setManageEmail(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="Email address"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">New password</label>
                  <input
                    type="password"
                    value={managePassword}
                    onChange={(e) => setManagePassword(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <p className="mt-1 text-xs text-gray-500">Leave blank to keep the current password.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Confirm password</label>
                  <input
                    type="password"
                    value={managePasswordConfirm}
                    onChange={(e) => setManagePasswordConfirm(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    disabled={!managePassword}
                    aria-disabled={!managePassword}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeManageAccount}
                    className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={manageAccountSaving}
                    className="rounded-2xl bg-red-600 hover:bg-red-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {manageAccountSaving ? "Saving…" : "Update password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manage course modal */}
      {manageCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={closeManageCourse}
        >
          <div
            className="w-full max-w-4xl rounded-3xl border border-rose-100 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-rose-100 bg-rose-50/40">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xl font-black truncate text-gray-900">{manageCourse.name}</div>
                  <div className="mt-1 text-sm text-gray-600 font-mono">
                    {manageCourse.code}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeManageCourse}
                    className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-4">
                <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5">
                  <div className="text-sm font-bold text-gray-800">Course details</div>
                  <form onSubmit={handleSaveCourseDetails} className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
                      <input
                        value={editCourseForm.name}
                        onChange={(e) => setEditCourseForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Code</label>
                      <input
                        value={editCourseForm.code}
                        onChange={(e) => setEditCourseForm((p) => ({ ...p, code: e.target.value }))}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-mono outline-none focus:border-red-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingCourse}
                      className="mt-1 w-full rounded-2xl bg-red-600 hover:bg-red-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {savingCourse ? "Saving…" : "Save changes"}
                    </button>
                  </form>
                </div>

                <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5">
                  <div className="text-sm font-bold text-gray-800">Course owner</div>
                  <select
                    value={manageCourse.professor_id || ""}
                    onChange={(e) => handleAssignProfessor(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                  >
                    <option value="">Unassigned</option>
                    {professorOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))}
                  </select>
                  <div className="mt-3 text-xs text-gray-600">
                    Current: {manageCourse.professorName || "Unassigned"}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-3xl border border-rose-100 bg-white">
                <div className="p-5 border-b border-rose-50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-gray-800">Enrolled students</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {manageCourse.studentsCount} total
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <select
                        value={selectedStudentToAdd}
                        onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                        className="sm:w-80 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-red-400 focus:bg-white"
                      >
                        <option value="">Select student to add…</option>
                        {studentOptions
                          .filter((s) => !manageEnrollments.some((e) => e.student?.studentDbId === s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.email}) • {s.student_id}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedStudentToAdd || addingEnrollment}
                        onClick={handleAddStudentToCourse}
                        className="rounded-2xl bg-red-600 hover:bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 whitespace-nowrap"
                      >
                        {addingEnrollment ? "Adding…" : "Add student"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-[55vh] overflow-y-auto">
                  {loadingEnrollments ? (
                    <div className="py-10 text-center text-gray-500 text-sm">Loading enrollments…</div>
                  ) : manageEnrollments.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 text-sm">No students enrolled.</div>
                  ) : (
                    <div className="divide-y divide-rose-50">
                      {manageEnrollments.map((en) => (
                        <div key={en.id} className="px-5 py-4 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-extrabold truncate text-gray-900">
                              {en.student?.name || "Unknown Student"}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              {en.student?.email || ""}{" "}
                              {en.student?.studentId ? (
                                <span className="text-gray-400 font-mono">• {en.student.studentId}</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm(`Remove ${en.student?.name || "this student"} from the course?`)) return;
                              handleRemoveEnrollment(en.id);
                            }}
                            className="shrink-0 rounded-2xl bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

