import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { data: courses, error } = await admin
      .from("courses")
      .select("id, name, code, classroom_code, professor_id, created_at")
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    // Enrollments count
    const courseIds = (courses ?? []).map((c: any) => c.id).filter(Boolean);
    const countsByCourseId: Record<string, number> = {};
    if (courseIds.length > 0) {
      const { data: enrollments, error: enrollErr } = await admin
        .from("enrollments")
        .select("course_id")
        .in("course_id", courseIds);
      if (enrollErr) return jsonError(enrollErr.message, 500);
      for (const row of enrollments ?? []) {
        const cid = (row as any).course_id as string;
        countsByCourseId[cid] = (countsByCourseId[cid] || 0) + 1;
      }
    }

    // Professor names (via professors.user_id -> users.name)
    const professorIds = [...new Set((courses ?? []).map((c: any) => c.professor_id).filter(Boolean))] as string[];
    const professorNameByProfessorId: Record<string, string> = {};
    if (professorIds.length > 0) {
      const { data: profRows, error: profErr } = await admin
        .from("professors")
        .select("id, user_id")
        .in("id", professorIds);
      if (profErr) return jsonError(profErr.message, 500);

      const userIds = (profRows ?? []).map((p: any) => p.user_id).filter(Boolean) as string[];
      const userNameById: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users, error: userErr } = await admin
          .from("users")
          .select("id, name")
          .in("id", userIds);
        if (userErr) return jsonError(userErr.message, 500);
        for (const u of users ?? []) {
          userNameById[(u as any).id] = (u as any).name || "";
        }
      }

      for (const p of profRows ?? []) {
        const pid = (p as any).id as string;
        const uid = (p as any).user_id as string;
        professorNameByProfessorId[pid] = userNameById[uid] || "Unknown Professor";
      }
    }

    const result = (courses ?? []).map((c: any) => ({
      ...c,
      studentsCount: countsByCourseId[c.id] || 0,
      professorName: c.professor_id ? professorNameByProfessorId[c.professor_id] || "Unknown Professor" : null,
    }));

    return NextResponse.json({ courses: result }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const code = String(body?.code ?? "").trim();
    const classroomCode = String(body?.classroom_code ?? "").trim();
    const professorId = body?.professor_id ? String(body.professor_id) : null;

    if (!name) return jsonError("name is required", 400);
    if (!code) return jsonError("code is required", 400);
    // Invite codes are not used in the UI anymore, but the DB column is NOT NULL.
    const finalClassroomCode = classroomCode || `${code}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const { data: course, error } = await admin
      .from("courses")
      .insert({
        name,
        code,
        classroom_code: finalClassroomCode,
        professor_id: professorId,
      })
      .select("id, name, code, classroom_code, professor_id, created_at")
      .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ course }, { status: 201 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

