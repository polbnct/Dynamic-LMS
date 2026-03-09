import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { attemptId, status, tabCount } = await request.json();

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    // Require an authenticated student session to prevent spoofing attempt IDs.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!student?.id) {
      return NextResponse.json({ error: "Student not found" }, { status: 403 });
    }

    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("id, student_id, submitted_at")
      .eq("id", attemptId)
      .single();

    if (!attempt) {
      return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 });
    }

    if (attempt.student_id !== student.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isSubmitted = !!attempt.submitted_at;
    const eventType = String(status || "online");
    const normalizedStatus =
      eventType === "focused" ||
      eventType === "blurred" ||
      eventType === "offline" ||
      eventType === "online" ||
      eventType === "tab_count"
        ? (eventType as "focused" | "blurred" | "offline" | "online" | "tab_count")
        : "online";

    // We no longer run high-frequency heartbeats from the client. This endpoint is now
    // meant only for occasional, explicit logs (e.g. important state changes).
    // To keep behaviour simple and predictable, we:
    // - Always insert a log row when this endpoint is called
    // - Only update basic activity columns on the attempt row
    const shouldLog = true;

    let logInserted = false;
    let logErrorMessage: string | null = null;
    if (shouldLog) {
      try {
        await admin.from("quiz_activity_logs").insert({
          attempt_id: attemptId,
          event_type: normalizedStatus,
          tab_count: typeof tabCount === "number" ? tabCount : 1,
        });
        logInserted = true;
      } catch (logErr) {
        logErrorMessage =
          (logErr as any)?.message ||
          (logErr as any)?.error?.message ||
          "quiz_activity_logs insert failed";
        console.warn("quiz_activity_logs insert failed (table may not exist):", logErr);
      }
    }

    // For submitted attempts, we only record the log row, not attempt activity columns.
    if (isSubmitted) {
      return NextResponse.json({
        success: true,
        logged: shouldLog ? logInserted : undefined,
        logError: logErrorMessage,
      });
    }

    // Simple, low-noise activity update for the attempt row.
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      last_activity_at: now,
    };

    try {
      const { error: updateError } = await admin
        .from("quiz_attempts")
        .update(updateData)
        .eq("id", attemptId);

      if (updateError) {
        console.warn("Activity columns may not exist:", updateError.message);
      }
    } catch (err) {
      console.warn("Error updating activity:", err);
    }

    return NextResponse.json({
      success: true,
      logged: shouldLog ? logInserted : undefined,
      logError: logErrorMessage,
    });
  } catch (error: any) {
    console.error("Error in quiz activity route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
