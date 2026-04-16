"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";

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
  const [search, setSearch] = useState("");
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

  const [createProfessorOpen, setCreateProfessorOpen] = useState(false);
  const [createProfessorSaving, setCreateProfessorSaving] = useState(false);
  const [createProfessorForm, setCreateProfessorForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [createProfessorError, setCreateProfessorError] = useState("");
  const [createProfessorSuccess, setCreateProfessorSuccess] = useState("");

  const professorOptions = useMemo(() => professors.slice().sort((a, b) => a.name.localeCompare(b.name)), [professors]);
  const studentOptions = useMemo(() => students.slice().sort((a, b) => a.name.localeCompare(b.name)), [students]);

  useSyncMessagesToToast(error, success);
  useSyncMessagesToToast(manageAccountError, manageAccountSuccess);
  useSyncMessagesToToast(createProfessorError, createProfessorSuccess);

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

  const openCreateProfessor = () => {
    setCreateProfessorForm({ name: "", email: "", password: "" });
    setCreateProfessorError("");
    setCreateProfessorSuccess("");
    setCreateProfessorOpen(true);
  };

  const closeCreateProfessor = () => {
    setCreateProfessorOpen(false);
    setCreateProfessorForm({ name: "", email: "", password: "" });
    setCreateProfessorError("");
  };

  const handleCreateProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createProfessorSaving) return;
    setCreateProfessorError("");
    setCreateProfessorSuccess("");

    const name = createProfessorForm.name.trim();
    const email = createProfessorForm.email.trim().toLowerCase().replace(/\s+/g, "");
    const password = createProfessorForm.password;

    if (!name) {
      setCreateProfessorError("Name is required.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateProfessorError("Please enter a valid email address.");
      return;
    }
    if (!password || password.trim().length < 8) {
      setCreateProfessorError("Password must be at least 8 characters long.");
      return;
    }

    setCreateProfessorSaving(true);
    try {
      await fetchJson<{ ok: true }>(`/api/admin/professors`, {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setCreateProfessorSuccess("Professor created.");
      closeCreateProfessor();
      await refreshAll();
    } catch (e: any) {
      setCreateProfessorError(e?.message || "Failed to create professor.");
    } finally {
      setCreateProfessorSaving(false);
    }
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
      setManageAccountOpen(false)
    } catch (e: any) {
      setManageAccountError(e?.message || "Failed to update account.");
    } finally {
      setManageAccountSaving(false);
    }
  };

  const filteredCourses = useMemo(() => {
  return courses.filter((c) =>
    [c.name, c.code, c.professorName || ""]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );
}, [courses, search]);

  const filteredProfessors = useMemo(() => {
    return professorOptions.filter((p) =>
      [p.name, p.email]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [professorOptions, search]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) =>
      [s.name, s.email, s.student_id]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [students, search]);

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
      code: "",
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
      setManageCourse(null);
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

  const statCards = [
    { label: "Courses", value: loading ? "—" : courses.length, hint: "Offerings in the system" },
    { label: "Professors", value: loading ? "—" : professors.length, hint: "Teaching accounts" },
    { label: "Students", value: loading ? "—" : students.length, hint: "Learner accounts" },
  ] as const;

  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md shadow-sm shadow-slate-900/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-slate-700 leading-none truncate">
                  Administration
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm shadow-slate-900/5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{s.value}</p>
              <p className="mt-1 text-xs text-slate-500">{s.hint}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-2 shadow-sm shadow-slate-900/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 p-1">
            <div
              className="flex w-full rounded-xl bg-slate-100/90 p-1 sm:w-auto sm:inline-flex"
              role="tablist"
              aria-label="Admin sections"
            >
              {(["courses", "professors", "students"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none sm:min-w-[7.5rem] ${
                    activeTab === tab
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab === "courses" ? "Courses" : tab === "professors" ? "Professors" : "Students"}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Refresh data
              </button>
              <button
                type="button"
                onClick={openCreateCourse}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                New course
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-[400px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-red-600" />
              <p className="text-sm font-medium text-slate-600">Loading directory…</p>
              <p className="mt-1 text-xs text-slate-500">Fetching courses, faculty, and students.</p>
            </div>
          ) : activeTab === "courses" ? (
            <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-sm">
              <div className="max-h-[400px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    {courses.length === 0 ? (
                      <div className="col-span-full px-5 py-14 text-center text-sm text-slate-500">
                        No courses yet.
                      </div>
                    ) : filteredCourses.length === 0 ? (
                      <div className="col-span-full px-5 py-14 text-center text-sm text-slate-500">
                        No results found.
                      </div>
                    ) : (
                  filteredCourses.map((c) => (
                    <div
                      key={c.id}
                      className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4 min-w-0">
                        <button
                          type="button"
                          onClick={() => openManageCourse(c)}
                          className="text-left flex-1 min-w-0 rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-slate-900 truncate group-hover:text-red-700 transition-colors">
                              {c.name}
                            </div>
                            <div className="mt-1 font-mono text-sm text-slate-600">{c.code}</div>
                            <div className="mt-3 text-xs text-slate-500">
                              <span className="text-slate-400">Instructor · </span>
                              {c.professorName || "Unassigned"}
                            </div>
                          </div>
                        </button>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {c.studentsCount} enrolled
                          </span>
                          <button
                            type="button"
                            disabled={deletingCourseId === c.id}
                            onClick={() => handleDeleteCourse(c.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {deletingCourseId === c.id ? "Deleting…" : "Delete"}
                          </button>
                      </div>
                    </div>
                  </div>
                  ))
                )}
                </div>
              </div>
            </div>
          ) : activeTab === "professors" ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="max-h-[450px] overflow-y-auto pr-1">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-4 backdrop-blur sm:flex-row">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Professors</h2>
                    <p className="text-xs text-slate-500">{professors.length} registered</p>
                  </div>
                <button
                  type="button"
                  onClick={openCreateProfessor}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60 cursor-pointer" 
                  disabled={createProfessorSaving}
                >
                  Add professor
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {professors.length === 0 ? (
                  <div className="px-5 py-14 text-center text-sm text-slate-500">
                    No professors yet.
                  </div>
                ) : filteredProfessors.length === 0 ? (
                  <div className="px-5 py-14 text-center text-sm text-slate-500">
                    No results found.
                  </div>
                ) : (
                filteredProfessors.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50/80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                      <div className="text-sm text-slate-600 truncate">{p.email}</div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
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
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer"
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        disabled={deletingProfessorId === p.id}
                        onClick={() => handleDeleteProfessor(p.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                      >
                        {deletingProfessorId === p.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                  )))}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="max-h-[450px] overflow-y-auto pr-1">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-4 backdrop-blur">
                  <h2 className="text-sm font-semibold text-slate-900">Students</h2>
                  <p className="text-xs text-slate-500">{students.length} registered</p>
                </div>
              <div className="divide-y divide-slate-100">
                {students.length === 0 ? (
                  <div className="px-5 py-14 text-center text-sm text-slate-500">
                    No students yet.
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="px-5 py-14 text-center text-sm text-slate-500">
                    No results found.
                  </div>
                ) : (
                  filteredStudents.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50/80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{s.name}</div>
                      <div className="text-sm text-slate-600 truncate">{s.email}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">{s.student_id}</div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
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
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        disabled={deletingStudentId === s.id}
                        onClick={() => handleDeleteStudent(s.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium shadow-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingStudentId === s.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                  )
                ))}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Create course modal */}
      {createCourseOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm"
          onClick={closeCreateCourse}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/90">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-900">Create course</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Create a new course, assign a professor, then enroll students manually.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCreateCourse}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateCourse} className="p-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-slate-700">Course name</label>
                <input
                  value={createCourseForm.name}
                  maxLength={64}
                  onChange={(e) => setCreateCourseForm((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-red-400 focus:bg-white"
                  placeholder="e.g. Data Structures"
                  autoFocus
                />
              </div>

              <div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Course code</label>
                  <input
                    value={createCourseForm.code}
                    maxLength={32}
                    onChange={(e) => setCreateCourseForm((p) => ({ ...p, code: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-red-400 focus:bg-white"
                    placeholder="Set course code here"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Assign professor (optional)</label>
                <select
                  value={createCourseForm.professor_id}
                  onChange={(e) => setCreateCourseForm((p) => ({ ...p, professor_id: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-red-400 focus:bg-white"
                >
                  <option value="">Unassigned</option>
                  {professorOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 w-full">
                <button
                  type="button"
                  onClick={closeCreateCourse}
                  disabled={creatingCourse}
                  className="w-full sm:flex-1 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 cursor-pointer"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={creatingCourse}
                  className="w-full sm:flex-1 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60 cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm"
          onClick={closeManageAccount}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/90">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-900">Manage account</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {manageAccountUser.kind === "professor" ? "Professor" : "Student"}:{" "}
                    <span className="font-semibold text-slate-900">{manageAccountUser.name}</span>{" "}
                    <span className="text-slate-500">({manageAccountUser.email})</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeManageAccount}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 min-w-0">
              <form onSubmit={handleAdminManageAccountSave} className="space-y-4 min-w-0">
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-slate-700">Name</label>
                  <input
                    type="text"
                    maxLength={64}
                    value={manageName}
                    onChange={(e) => setManageName(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    maxLength={64}
                    value={manageEmail}
                    onChange={(e) => setManageEmail(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="Email address"
                    autoComplete="email"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-slate-700">New password</label>
                  <input
                    type="password"
                    value={managePassword}
                    onChange={(e) => setManagePassword(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <p className="mt-1 text-xs text-slate-500">Leave blank to keep the current password.</p>
                </div>

                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-slate-700">Confirm password</label>
                  <input
                    type="password"
                    value={managePasswordConfirm}
                    onChange={(e) => setManagePasswordConfirm(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    disabled={!managePassword}
                    aria-disabled={!managePassword}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 w-full">
                  <button
                    type="button"
                    onClick={closeManageAccount}
                    className="w-full sm:flex-1 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={manageAccountSaving}
                    className="w-full sm:flex-1 rounded-2xl bg-red-600 hover:bg-red-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {manageAccountSaving ? "Saving…" : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create professor modal */}
      {createProfessorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm"
          onClick={closeCreateProfessor}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/90">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-900">Create professor</div>
                  <div className="mt-1 text-sm text-slate-600">Creates a sign-in and a professor profile.</div>
                </div>
                <button
                  type="button"
                  onClick={closeCreateProfessor}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <form onSubmit={handleCreateProfessor} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Name</label>
                  <input
                    type="text"
                    maxLength={64}
                    value={createProfessorForm.name}
                    onChange={(e) => setCreateProfessorForm((p) => ({ ...p, name: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="Full name"
                    autoComplete="name"
                    disabled={createProfessorSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    maxLength={128}
                    value={createProfessorForm.email}
                    onChange={(e) => setCreateProfessorForm((p) => ({ ...p, email: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="Email address"
                    autoComplete="email"
                    disabled={createProfessorSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <input
                    type="password"
                    value={createProfessorForm.password}
                    onChange={(e) => setCreateProfessorForm((p) => ({ ...p, password: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    disabled={createProfessorSaving}
                  />
                  <p className="mt-1 text-xs text-slate-500">Password will be set for the created professor.</p>
                </div>

                <div className="flex flex-col items-center justify-end gap-2 pt-2 sm:flex-row w-full sm:justify-end">
                  <button
                    type="button"
                    onClick={closeCreateProfessor}
                    disabled={createProfessorSaving}
                    className="w-full sm:flex-1 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createProfessorSaving}
                    className="w-full sm:flex-1 rounded-2xl bg-red-600 hover:bg-red-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {createProfessorSaving ? "Creating…" : "Create"}
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
          className="fixed inset-0 z-50 overflow-y-auto sm:overflow-hidden bg-slate-900/45 backdrop-blur-sm p-3 sm:p-4"
          onClick={closeManageCourse}
        >
        <div className="flex min-h-screen sm:h-screen items-start sm:items-center justify-center">
          <div
            className="w-full max-w-4xl max-h-none sm:max-h-[90vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/90">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-semibold truncate text-slate-900">{manageCourse.name}</div>
                  <div className="mt-1 text-sm text-slate-600 font-mono">
                    {manageCourse.code}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeManageCourse}
                    className="w-full sm:w-auto rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:flex-1 sm:overflow-hidden min-w-0">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-5">
                  <div className="text-sm font-semibold text-slate-900">Course details</div>
                  <form onSubmit={handleSaveCourseDetails} className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                      <input
                        value={editCourseForm.name}
                        maxLength={64}
                        onChange={(e) => setEditCourseForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                      <input
                        value={editCourseForm.code}
                        onChange={(e) => setEditCourseForm((p) => ({ ...p, code: e.target.value }))}
                        maxLength={32}
                        placeholder="e.g TUPD9126"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono outline-none focus:border-red-400"
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

                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-5">
                  <div className="text-sm font-semibold text-slate-900">Course owner</div>
                  <select
                    value={manageCourse.professor_id || ""}
                    onChange={(e) => handleAssignProfessor(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                  >
                    <option value="">Unassigned</option>
                    {professorOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))}
                  </select>
                  <div className="mt-3 text-xs text-slate-600">
                    Current: {manageCourse.professorName || "Unassigned"}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Enrolled students</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {manageCourse.studentsCount} total
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto ">
                      <select
                        value={selectedStudentToAdd}
                        onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                        className="sm:w-80 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-red-400 focus:bg-white"
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

                <div className="max-h-[50vh] sm:max-h-[55vh] overflow-y-auto">
                  {loadingEnrollments ? (
                    <div className="py-10 text-center text-slate-500 text-sm">Loading enrollments…</div>
                  ) : manageEnrollments.length === 0 ? (
                    <div className="py-10 text-center text-slate-500 text-sm">No students enrolled.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {manageEnrollments.map((en) => (
                        <div key={en.id} className="px-5 py-4 flex items-center justify-between gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate text-slate-900">
                              {en.student?.name || "Unknown Student"}
                            </div>
                            <div className="text-sm text-slate-600 truncate">
                              {en.student?.email || ""}{" "}
                              {en.student?.studentId ? (
                                <span className="text-slate-400 font-mono">• {en.student.studentId}</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm(`Remove ${en.student?.name || "this student"} from the course?`)) return;
                              handleRemoveEnrollment(en.id);
                            }}
                            className="shrink-0 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white"
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
      </div>
      )}
    </div>
  );
}