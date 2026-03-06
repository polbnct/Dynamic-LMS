import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const attemptIds = (body?.attemptIds || []) as string[];
    if (!Array.isArray(attemptIds) || attemptIds.length === 0) {
      return NextResponse.json({ logsByAttemptId: {} }, { status: 200 });
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    // Require authenticated professor
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

    // Verify these attempts belong to quizzes under this professor's courses
    // 1) attemptIds -> quiz_ids
    const { data: attempts, error: attemptsErr } = await admin
      .from("quiz_attempts")
      .select("id, quiz_id")
      .in("id", attemptIds);
    if (attemptsErr) {
      return NextResponse.json({ error: "Failed to load attempts" }, { status: 500 });
    }
    const quizIds = [...new Set((attempts || []).map((a: any) => a.quiz_id).filter(Boolean))] as string[];
    if (quizIds.length === 0) return NextResponse.json({ logsByAttemptId: {} }, { status: 200 });

    // 2) quizIds -> courseIds
    const { data: quizzes, error: quizzesErr } = await admin
      .from("quizzes")
      .select("id, course_id")
      .in("id", quizIds);
    if (quizzesErr) {
      return NextResponse.json({ error: "Failed to load quizzes" }, { status: 500 });
    }
    const courseIds = [...new Set((quizzes || []).map((q: any) => q.course_id).filter(Boolean))] as string[];
    if (courseIds.length === 0) return NextResponse.json({ logsByAttemptId: {} }, { status: 200 });

    // 3) check professor owns all those courses
    const { data: courses, error: coursesErr } = await admin
      .from("courses")
      .select("id, professor_id")
      .in("id", courseIds);
    if (coursesErr) {
      return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
    }
    const notOwned = (courses || []).some((c: any) => c.professor_id !== prof.id);
    if (notOwned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Fetch logs (newest first)
    const { data: logs, error: logsErr } = await admin
      .from("quiz_activity_logs")
      .select("id, attempt_id, event_type, tab_count, created_at")
      .in("attempt_id", attemptIds)
      .order("created_at", { ascending: false });

    if (logsErr) {
      return NextResponse.json({ error: "Failed to load logs" }, { status: 500 });
    }

    const logsByAttemptId: Record<string, any[]> = {};
    attemptIds.forEach((id) => (logsByAttemptId[id] = []));
    (logs || []).forEach((row: any) => {
      logsByAttemptId[row.attempt_id] = logsByAttemptId[row.attempt_id] || [];
      logsByAttemptId[row.attempt_id].push(row);
    });

    return NextResponse.json({ logsByAttemptId }, { status: 200 });
  } catch (error: any) {
    console.error("Error in quiz activity logs route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

