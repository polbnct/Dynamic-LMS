import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { courseId } = await params;
    if (!courseId) return jsonError("courseId is required", 400);

    const { data: enrollments, error } = await admin
      .from("enrollments")
      .select("id, enrolled_at, student_id")
      .eq("course_id", courseId)
      .order("enrolled_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    const studentDbIds = (enrollments ?? []).map((e: any) => e.student_id).filter(Boolean) as string[];
    let studentsById: Record<string, any> = {};
    if (studentDbIds.length > 0) {
      const { data: students, error: studErr } = await admin
        .from("students")
        .select("id, user_id, student_id")
        .in("id", studentDbIds);
      if (studErr) return jsonError(studErr.message, 500);

      const userIds = (students ?? []).map((s: any) => s.user_id).filter(Boolean) as string[];
      let usersById: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: users, error: userErr } = await admin
          .from("users")
          .select("id, name, email, role")
          .in("id", userIds);
        if (userErr) return jsonError(userErr.message, 500);
        usersById = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));
      }

      studentsById = Object.fromEntries(
        (students ?? [])
          .filter((s: any) => usersById[s.user_id]?.role !== "admin")
          .map((s: any) => [
            s.id,
            {
              studentDbId: s.id,
              authUserId: s.user_id,
              studentId: s.student_id,
              name: usersById[s.user_id]?.name || "Unknown Student",
              email: usersById[s.user_id]?.email || "",
            },
          ])
      );
    }

    const result = (enrollments ?? [])
      .filter((e: any) => Boolean(studentsById[e.student_id]))
      .map((e: any) => ({
      id: e.id,
      enrolled_at: e.enrolled_at,
      course_id: courseId,
      student: studentsById[e.student_id] || null,
    }));

    return NextResponse.json({ enrollments: result }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

