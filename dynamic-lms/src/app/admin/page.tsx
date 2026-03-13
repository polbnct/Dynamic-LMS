"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AdminCourse = {
  id: string;
  name: string;
  code: string;
  classroom_code: string;
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
  department: string | null;
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

  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [createCourseForm, setCreateCourseForm] = useState({
    name: "",
    code: "",
    classroom_code: "",
    professor_id: "",
  });

  const [manageCourse, setManageCourse] = useState<AdminCourse | null>(null);
  const [manageEnrollments, setManageEnrollments] = useState<AdminEnrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [regeneratingInvite, setRegeneratingInvite] = useState(false);

  const professorOptions = useMemo(() => professors.slice().sort((a, b) => a.name.localeCompare(b.name)), [professors]);

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
      classroom_code: generateInviteCode(),
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
    if (!createCourseForm.classroom_code.trim()) {
      setError("Invite code is required.");
      return;
    }

    setCreatingCourse(true);
    try {
      await fetchJson<{ course: AdminCourse }>("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          name: createCourseForm.name.trim(),
          code: createCourseForm.code.trim(),
          classroom_code: createCourseForm.classroom_code.trim(),
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
    if (loadingEnrollments || regeneratingInvite) return;
    setManageCourse(null);
    setManageEnrollments([]);
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

  const handleRegenerateInvite = async () => {
    if (!manageCourse) return;
    setError("");
    setSuccess("");
    setRegeneratingInvite(true);
    try {
      const res = await fetchJson<{ classroom_code: string }>(
        `/api/admin/courses/${encodeURIComponent(manageCourse.id)}/invite-code`,
        { method: "POST" }
      );
      setSuccess("Invite code regenerated.");
      const classroom_code = res.classroom_code;
      setManageCourse((prev) => (prev ? { ...prev, classroom_code } : prev));
      setCourses((prev) => prev.map((c) => (c.id === manageCourse.id ? { ...c, classroom_code } : c)));
    } catch (e: any) {
      setError(e?.message || "Failed to regenerate invite code.");
    } finally {
      setRegeneratingInvite(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-red-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-red-700 via-rose-600 to-red-500 bg-clip-text text-transparent">
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
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openManageCourse(c)}
                  className="text-left rounded-3xl border border-rose-100 bg-white hover:bg-rose-50/70 p-5 transition shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-lg font-extrabold truncate text-gray-900">{c.name}</div>
                      <div className="mt-1 text-sm text-gray-600">
                        <span className="font-mono text-gray-800">{c.code}</span>
                        <span className="mx-2 text-gray-300">•</span>
                        <span className="font-mono text-rose-600">Invite: {c.classroom_code}</span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Owner: {c.professorName || "Unassigned"} {c.professor_id ? "" : "(no professor)"}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {c.studentsCount} student{c.studentsCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </button>
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
                    <div className="text-xs text-gray-500">
                      {p.department ? `Dept: ${p.department}` : "No department"}
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
                    <div className="text-xs text-gray-500 font-mono">
                      {s.student_id}
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
            className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-black text-gray-900">Create course</div>
                <div className="mt-1 text-sm text-gray-500">Admin-only course provisioning.</div>
              </div>
              <button
                type="button"
                onClick={closeCreateCourse}
                className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700">Course name</label>
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
                  <label className="text-xs font-bold text-gray-700">Course code</label>
                  <input
                    value={createCourseForm.code}
                    onChange={(e) => setCreateCourseForm((p) => ({ ...p, code: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono outline-none focus:border-red-400 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Invite code</label>
                  <input
                    value={createCourseForm.classroom_code}
                    onChange={(e) => setCreateCourseForm((p) => ({ ...p, classroom_code: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono outline-none focus:border-red-400 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">Assign professor (optional)</label>
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

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateCourseForm((p) => ({
                      ...p,
                      code: generateCourseCode(),
                      classroom_code: generateInviteCode(),
                    }));
                  }}
                  className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  Regenerate codes
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

      {/* Manage course modal */}
      {manageCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify_center p-4 bg-black/30 backdrop-blur-sm"
          onClick={closeManageCourse}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xl font-black truncate text-gray-900">{manageCourse.name}</div>
                <div className="mt-1 text-sm text-gray-600 font-mono">
                  {manageCourse.code} • Invite: {manageCourse.classroom_code}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerateInvite}
                  disabled={regeneratingInvite}
                  className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
                >
                  {regeneratingInvite ? "Regenerating…" : "Regenerate invite"}
                </button>
                <button
                  type="button"
                  onClick={closeManageCourse}
                  className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4">
                <div className="text-xs font-bold text-gray-800">Course owner</div>
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

              <div className="lg:col-span-2 rounded-3xl border border-rose-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-gray-800">Enrolled students</div>
                  <div className="text-xs text-gray-500">
                    {manageCourse.studentsCount} total
                  </div>
                </div>

                {loadingEnrollments ? (
                  <div className="py-8 text-center text-gray-500 text-sm">Loading enrollments…</div>
                ) : manageEnrollments.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-sm">No students enrolled.</div>
                ) : (
                  <div className="mt-3 divide-y divide-rose-50">
                    {manageEnrollments.map((en) => (
                      <div key={en.id} className="py-3 flex items-center justify-between gap-3">
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
      )}
    </div>
  );
}

