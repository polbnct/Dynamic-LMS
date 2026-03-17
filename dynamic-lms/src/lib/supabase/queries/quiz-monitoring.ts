import { createClient } from "../client";

export interface StudentQuizStatus {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  startedAt: string;
  isOnline: boolean;
  isFocused: boolean;
  tabCount: number;
  lastActivityAt: string | null;
  submittedAt: string | null;
}

function computeIsOnlineFromLastActivity(lastActivityAt: string | null, thresholdSeconds = 15): boolean {
  if (!lastActivityAt) return true;
  const ageMs = new Date().getTime() - new Date(lastActivityAt).getTime();
  return ageMs <= thresholdSeconds * 1000;
}

/** One attempt log for a student (same shape as StudentQuizStatus but used inside grouped data) */
export type AttemptLog = StudentQuizStatus;

/** Per-student grouping with all their attempts (logs) for this quiz */
export interface StudentWithAttempts {
  studentId: string;
  studentName: string;
  studentEmail: string;
  attempts: AttemptLog[];
}

/** Get all quiz attempts for this quiz, grouped by student. Includes both active and submitted attempts. */
export async function getQuizAttemptsGroupedByStudent(quizId: string): Promise<StudentWithAttempts[]> {
  try {
    const supabase = createClient();

    const { data: attempts, error } = await supabase
      .from("quiz_attempts")
      .select("id, student_id, started_at, submitted_at")
      .eq("quiz_id", quizId)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Error fetching quiz attempts:", error);
      return [];
    }

    if (!attempts || attempts.length === 0) return [];

    let activityData: Record<string, { is_online?: boolean; is_focused?: boolean; tab_count?: number; last_activity_at?: string | null }> = {};
    try {
      const { data: activityRows } = await supabase
        .from("quiz_attempts")
        .select("id, is_online, is_focused, tab_count, last_activity_at")
        .eq("quiz_id", quizId);
      if (activityRows) {
        activityRows.forEach((row: any) => {
          activityData[row.id] = {
            is_online: row.is_online,
            is_focused: row.is_focused,
            tab_count: row.tab_count,
            last_activity_at: row.last_activity_at,
          };
        });
      }
    } catch (_) {
      // Activity columns may not exist
    }

    const studentIds = [...new Set(attempts.map((a: any) => a.student_id).filter(Boolean))];
    let studentInfoMap: Record<string, { name: string; email: string }> = {};
    const excludedStudentIds = new Set<string>();

    if (studentIds.length > 0) {
      try {
        const { data: studentsData } = await supabase
          .from("students")
          .select(`
            id,
            user_id,
            users ( id, name, email, role )
          `)
          .in("id", studentIds);

        if (studentsData) {
          studentsData.forEach((student: any) => {
            const user = Array.isArray(student.users) ? student.users[0] : student.users || {};
            if (user?.role === "admin") {
              // Exclude admin accounts that may still have a students row.
              excludedStudentIds.add(student.id);
              return;
            }
            studentInfoMap[student.id] = {
              name: (user && user.name) ? user.name : "Unknown Student",
              email: (user && user.email) ? user.email : "",
            };
          });
        }
      } catch (e) {
        console.warn("Error fetching student info:", e);
      }
    }

    const attemptLogs: StudentQuizStatus[] = attempts
      .filter((attempt: any) => {
        // Only include attempts we can attribute to a non-admin student.
        if (!attempt?.student_id) return false;
        if (excludedStudentIds.has(attempt.student_id)) return false;
        if (!studentInfoMap[attempt.student_id]) return false;
        return true;
      })
      .map((attempt: any) => {
      const studentInfo = studentInfoMap[attempt.student_id] || { name: "Unknown Student", email: "" };
      const activity = activityData[attempt.id] || {};
      const lastActivityAt = activity.last_activity_at ?? null;
      return {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        startedAt: attempt.started_at,
        isOnline: computeIsOnlineFromLastActivity(lastActivityAt, 15),
        isFocused: activity.is_focused ?? true,
        tabCount: activity.tab_count ?? 1,
        lastActivityAt,
        submittedAt: attempt.submitted_at,
      };
    });

    const byStudent = new Map<string, StudentQuizStatus[]>();
    for (const log of attemptLogs) {
      if (!byStudent.has(log.studentId)) byStudent.set(log.studentId, []);
      byStudent.get(log.studentId)!.push(log);
    }

    const firstLog = (logs: StudentQuizStatus[]) => logs[0];
    return Array.from(byStudent.entries()).map(([studentId, attempts]) => ({
      studentId,
      studentName: firstLog(attempts).studentName,
      studentEmail: firstLog(attempts).studentEmail,
      attempts,
    }));
  } catch (err: any) {
    console.error("getQuizAttemptsGroupedByStudent error:", err);
    return [];
  }
}

export interface QuizActivityLogEntry {
  id: string;
  attempt_id: string;
  event_type: string;
  tab_count: number | null;
  created_at: string;
}

/** Fetch activity logs (tab switch, focus, etc.) for the given attempt IDs. Returns a map attemptId -> logs (newest first). */
export async function getActivityLogsForAttempts(
  attemptIds: string[]
): Promise<Record<string, QuizActivityLogEntry[]>> {
  if (attemptIds.length === 0) return {};
  try {
    // Use server API (service-role) so professor can read logs even if RLS blocks direct selects.
    const res = await fetch("/api/quiz-activity/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptIds }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("getActivityLogsForAttempts api failed:", res.status, text);
      return {};
    }
    const json = (await res.json().catch(() => null)) as any;
    const raw = (json?.logsByAttemptId || {}) as Record<string, any[]>;
    const byAttempt: Record<string, QuizActivityLogEntry[]> = {};
    for (const id of attemptIds) byAttempt[id] = [];
    Object.entries(raw).forEach(([attemptId, rows]) => {
      byAttempt[attemptId] = (rows || []).map((row: any) => ({
        id: row.id,
        attempt_id: row.attempt_id,
        event_type: row.event_type,
        tab_count: row.tab_count,
        created_at: row.created_at,
      }));
    });
    return byAttempt;
  } catch (err: any) {
    console.warn("getActivityLogsForAttempts error:", err);
    return {};
  }
}
