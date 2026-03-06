import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { quizId } = await request.json();
    if (!quizId) return NextResponse.json({ error: "quizId is required" }, { status: 400 });

    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: prof } = await supabase
      .from("professors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!prof?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: quiz } = await admin
      .from("quizzes")
      .select("id, course_id, max_attempts")
      .eq("id", quizId)
      .single();
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

    const { data: course } = await admin
      .from("courses")
      .select("id, professor_id")
      .eq("id", quiz.course_id)
      .single();
    if (!course || course.professor_id !== prof.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // enrolled students (student table ids)
    const { data: enrollments } = await admin
      .from("enrollments")
      .select("student_id, students(id, user_id, student_id, users(name,email))")
      .eq("course_id", quiz.course_id);

    const studentRows = (enrollments || []).map((e: any) => {
      const s = e.students;
      const userRec = s && (Array.isArray(s.users) ? s.users[0] : s.users);
      return {
        studentDbId: e.student_id,
        name: userRec?.name ?? "Unknown Student",
        email: userRec?.email ?? "",
        studentNo: s?.student_id ?? "",
      };
    });

    // attempts used (submitted only)
    const { data: attempts } = await admin
      .from("quiz_attempts")
      .select("student_id, submitted_at")
      .eq("quiz_id", quizId)
      .not("submitted_at", "is", null);

    const usedMap: Record<string, number> = {};
    (attempts || []).forEach((a: any) => {
      usedMap[a.student_id] = (usedMap[a.student_id] || 0) + 1;
    });

    // retake allowances
    const { data: retakes } = await admin
      .from("quiz_retakes")
      .select("student_id, extra_attempts")
      .eq("quiz_id", quizId);
    const extraMap: Record<string, number> = {};
    (retakes || []).forEach((r: any) => {
      extraMap[r.student_id] = r.extra_attempts != null ? Number(r.extra_attempts) : 0;
    });

    const baseMax = quiz.max_attempts == null ? null : Number(quiz.max_attempts);
    const rows = studentRows.map((s) => {
      const used = usedMap[s.studentDbId] || 0;
      const extra = extraMap[s.studentDbId] || 0;
      const allowed = baseMax == null ? null : baseMax + extra;
      const remaining = allowed == null ? null : Math.max(allowed - used, 0);
      return {
        studentDbId: s.studentDbId,
        name: s.name,
        email: s.email,
        studentNo: s.studentNo,
        attemptsUsed: used,
        extraAttempts: extra,
        maxAttempts: baseMax,
        allowedAttempts: allowed,
        remainingAttempts: remaining,
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (error: any) {
    console.error("retakes list error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

