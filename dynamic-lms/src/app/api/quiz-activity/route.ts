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

    // Insert a log row for meaningful events (tab switch, focus, offline, multi-tab).
    // Avoid spamming logs for heartbeat "online" pings.
    const shouldLog =
      normalizedStatus !== "online" || (typeof tabCount === "number" && Number(tabCount) > 1);

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

    // For submitted attempts, do not update is_online/is_focused so we don't overwrite with "offline"
    if (isSubmitted) {
      return NextResponse.json({ success: true, logged: shouldLog ? logInserted : undefined, logError: logErrorMessage });
    }

    // Status mapping:
    // - focused  -> focused=true, last_activity_at=now
    // - blurred  -> focused=false, last_activity_at=now  (alt-tab / not focused is NOT offline)
    // - online   -> last_activity_at=now (heartbeat)
    // - offline  -> do NOT update last_activity_at (offline is inferred from missing heartbeats)
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      tab_count: tabCount ?? 1,
    };

    if (normalizedStatus !== "offline") {
      updateData.last_activity_at = now;
    }

    // Keep is_online true while we are receiving events/heartbeats.
    // "Offline" should be inferred on the read side from last_activity_at staleness.
    updateData.is_online = true;

    if (normalizedStatus === "focused") {
      updateData.is_focused = true;
    } else if (normalizedStatus === "blurred" || normalizedStatus === "offline") {
      updateData.is_focused = false;
    }

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

    return NextResponse.json({ success: true, logged: shouldLog ? logInserted : undefined, logError: logErrorMessage });
  } catch (error: any) {
    console.error("Error in quiz activity route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
