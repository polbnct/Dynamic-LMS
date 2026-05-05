import { createClient } from "../client";

export interface Grade {
  id: string;
  type: "assignment" | "quiz" | "exam";
  title: string;
  // Underlying assessment id (assignment_id or quiz_id)
  itemId: string;
  category: "prelim" | "midterm" | "finals";
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt?: string;
  gradedAt?: string;
  feedback?: string;
}

const GRADE_CATEGORIES = ["prelim", "midterm", "finals"] as const;

function normalizeQuizGradeCategory(raw: unknown): Grade["category"] {
  return raw && GRADE_CATEGORIES.includes(raw as Grade["category"])
    ? (raw as Grade["category"])
    : "prelim";
}

// Get grades for a student in a course
export async function getStudentGrades(courseId: string, studentId: string): Promise<Grade[]> {
  const supabase = createClient();

  // Get assignment grades - first get assignments for course, then submissions
  const { data: courseAssignments } = await supabase
    .from("assignments")
    .select("id")
    .eq("course_id", courseId);

  const assignmentIds = courseAssignments?.map((a) => a.id) || [];

  const { data: assignmentSubmissions } = assignmentIds.length > 0
    ? await supabase
        .from("assignment_submissions")
        .select("*, assignments(*)")
        .eq("student_id", studentId)
        .in("assignment_id", assignmentIds)
    : { data: null };

  // Get quiz grades - first get quizzes for course, then attempts
  const { data: courseQuizzes } = await supabase
    .from("quizzes")
    .select("id")
    .eq("course_id", courseId);

  const quizIds = courseQuizzes?.map((q) => q.id) || [];

  const { data: quizAttempts } = quizIds.length > 0
    ? await supabase
        .from("quiz_attempts")
        .select("*, quizzes(*)")
        .eq("student_id", studentId)
        .in("quiz_id", quizIds)
        .not("submitted_at", "is", null)
    : { data: null };

  const grades: Grade[] = [];

  // Process assignment grades
  if (assignmentSubmissions) {
    for (const submission of assignmentSubmissions) {
      const assignment = submission.assignments;
      if (assignment && assignment.course_id === courseId) {
        grades.push({
          id: submission.id,
          type: "assignment",
          title: assignment.title,
          itemId: assignment.id,
          category: assignment.category,
          score: submission.score || 0,
          maxScore: submission.max_score || 100,
          percentage: submission.max_score > 0 ? ((submission.score || 0) / submission.max_score) * 100 : 0,
          submittedAt: submission.submitted_at,
          gradedAt: submission.graded_at,
          feedback: submission.feedback ?? "",
        });
      }
    }
  }

  // Process quiz grades
  if (quizAttempts) {
    for (const attempt of quizAttempts) {
      const quiz = attempt.quizzes;
      if (quiz && quiz.course_id === courseId && attempt.submitted_at) {
        grades.push({
          id: attempt.id,
          type: "quiz",
          title: quiz.name,
          itemId: quiz.id,
          category: normalizeQuizGradeCategory((quiz as { category?: unknown }).category),
          score: attempt.score || 0,
          maxScore: attempt.max_score || 100,
          percentage: attempt.max_score > 0 ? ((attempt.score || 0) / attempt.max_score) * 100 : 0,
          submittedAt: attempt.submitted_at,
          gradedAt: attempt.submitted_at,
        });
      }
    }
  }

  return grades;
}

