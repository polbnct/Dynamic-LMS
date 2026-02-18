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

export async function getActiveQuizAttempts(quizId: string): Promise<StudentQuizStatus[]> {
  try {
    const supabase = createClient();

    // Get all active quiz attempts (not submitted)
    // First, get the attempts
    const { data: attempts, error } = await supabase
      .from("quiz_attempts")
      .select(`
        id,
        student_id,
        started_at,
        submitted_at
      `)
      .eq("quiz_id", quizId)
      .is("submitted_at", null)
      .order("started_at", { ascending: false });

    if (error) {
      // Extract error details properly
      const errorInfo: any = {};
      try {
        for (const key in error) {
          errorInfo[key] = (error as any)[key];
        }
      } catch (e) {
        // If we can't iterate, try JSON
        try {
          const errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
          console.error("Error as JSON:", errorStr);
        } catch (e2) {
          console.error("Could not stringify error");
        }
      }
      
      const errorMessage = 
        error.message || 
        errorInfo.message || 
        (error as any)?.message ||
        String(error);
      const errorDetails = 
        error.details || 
        errorInfo.details || 
        (error as any)?.details ||
        null;
      const errorHint = 
        error.hint || 
        errorInfo.hint || 
        (error as any)?.hint ||
        null;
      const errorCode = 
        error.code || 
        errorInfo.code || 
        (error as any)?.code ||
        null;
      
      console.error("=== ERROR FETCHING ACTIVE QUIZ ATTEMPTS ===");
      console.error("Error message:", errorMessage);
      console.error("Error details:", errorDetails);
      console.error("Error hint:", errorHint);
      console.error("Error code:", errorCode);
      console.error("Full error object:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      console.error("Quiz ID:", quizId);
      
      // Return empty array instead of throwing to prevent UI crashes
      console.warn("Returning empty array due to error");
      return [];
    }

  // Try to fetch activity columns separately if they exist
  // This allows the query to work even if the migration hasn't been run
  let activityData: Record<string, any> = {};
  try {
    const { data: activityRows } = await supabase
      .from("quiz_attempts")
      .select("id, is_online, is_focused, tab_count, last_activity_at")
      .eq("quiz_id", quizId)
      .is("submitted_at", null);
    
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
  } catch (activityError) {
    // Activity columns don't exist yet - that's okay, we'll use defaults
    console.warn("Activity columns not available (migration may not be run):", activityError);
  }

  if (!attempts || attempts.length === 0) {
    return [];
  }

  // Get student IDs and fetch student/user info
  const studentIds = attempts.map((a: any) => a.student_id).filter(Boolean);
  
  let studentInfoMap: Record<string, { name: string; email: string }> = {};
  
  if (studentIds.length > 0) {
    try {
      // Fetch students and their user info
      const { data: studentsData } = await supabase
        .from("students")
        .select(`
          id,
          user_id,
          users (
            id,
            name,
            email
          )
        `)
        .in("id", studentIds);

      if (studentsData) {
        studentsData.forEach((student: any) => {
          const user = Array.isArray(student.users) ? student.users[0] : student.users || {};
          studentInfoMap[student.id] = {
            name: user.name || "Unknown Student",
            email: user.email || "",
          };
        });
      }
    } catch (studentError) {
      console.warn("Error fetching student info:", studentError);
    }
  }

  // Transform the data
  return attempts.map((attempt: any) => {
    const studentInfo = studentInfoMap[attempt.student_id] || { name: "Unknown Student", email: "" };
    const activity = activityData[attempt.id] || {};
    
    return {
      attemptId: attempt.id,
      studentId: attempt.student_id,
      studentName: studentInfo.name,
      studentEmail: studentInfo.email,
      startedAt: attempt.started_at,
      isOnline: activity.is_online ?? true, // Default to true if column doesn't exist
      isFocused: activity.is_focused ?? true, // Default to true if column doesn't exist
      tabCount: activity.tab_count ?? 1, // Default to 1 if column doesn't exist
      lastActivityAt: activity.last_activity_at || null,
      submittedAt: attempt.submitted_at,
    };
  });
  } catch (err: any) {
    console.error("=== EXCEPTION IN getActiveQuizAttempts ===");
    console.error("Error:", err);
    console.error("Error message:", err?.message);
    console.error("Error stack:", err?.stack);
    console.error("Quiz ID:", quizId);
    // Return empty array instead of throwing
    return [];
  }
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

    if (studentIds.length > 0) {
      try {
        const { data: studentsData } = await supabase
          .from("students")
          .select(`
            id,
            user_id,
            users ( id, name, email )
          `)
          .in("id", studentIds);

        if (studentsData) {
          studentsData.forEach((student: any) => {
            const user = Array.isArray(student.users) ? student.users[0] : student.users || {};
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

    const attemptLogs: StudentQuizStatus[] = attempts.map((attempt: any) => {
      const studentInfo = studentInfoMap[attempt.student_id] || { name: "Unknown Student", email: "" };
      const activity = activityData[attempt.id] || {};
      return {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        startedAt: attempt.started_at,
        isOnline: activity.is_online ?? true,
        isFocused: activity.is_focused ?? true,
        tabCount: activity.tab_count ?? 1,
        lastActivityAt: activity.last_activity_at ?? null,
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
