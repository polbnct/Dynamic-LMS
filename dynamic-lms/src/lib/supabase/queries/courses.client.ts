import { createClient } from "../client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteQuiz } from "@/lib/supabase/queries/quizzes";

export interface Course {
  id: string;
  name: string;
  code: string;
  professor_id: string;
  created_at: string;
  studentsCount?: number;
}

export interface CourseWithStudents extends Course {
  students: any[];
  studentsCount: number;
  professorName?: string;
  lessonsCount?: number;
  assignmentsCount?: number;
  quizzesCount?: number;
}

// Get professor's courses (client-side)
export async function getProfessorCourses(professorId: string): Promise<CourseWithStudents[]> {
  const supabase = createClient();

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .eq("professor_id", professorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching professor courses:", error);
    throw error;
  }

  if (!courses || courses.length === 0) {
    return [];
  }

  // Get enrollment counts and professor name for each course
  const coursesWithCounts = await Promise.all(
    courses.map(async (course) => {
      const { count } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", course.id);
      
      const[
        {count: lessonsCount},
        {count: assignmentsCount},
        {count : quizzesCount},
      ] = await Promise.all([
        supabase
        .from("lessons")
        .select("*", {count: "exact", head: true})
        .eq("course_id", course.id),

        supabase
          .from("assignments")
          .select("*", { count: "exact", head: true })
          .eq("course_id", course.id),

        supabase
          .from("quizzes")
          .select("*", { count: "exact", head: true })
          .eq("course_id", course.id),
      ]);

      // Get professor name from users table
      let professorName = "Unknown Professor";
      try {
        const { data: professor } = await supabase
          .from("professors")
          .select("user_id")
          .eq("id", course.professor_id)
          .maybeSingle();
        
        if (professor?.user_id) {
          const { data: user } = await supabase
            .from("users")
            .select("name")
            .eq("id", professor.user_id)
            .maybeSingle();
          professorName = user?.name || "Unknown Professor";
        }
      } catch (err) {
        console.warn("Error fetching professor name:", err);
      }

      return {
        ...course,
        students: [],
        studentsCount: count || 0,
        professorName,
                lessonsCount: lessonsCount || 0,
        assignmentsCount: assignmentsCount || 0,
        quizzesCount: quizzesCount ||0,
      };
    })
  );
  return coursesWithCounts;
}

// Get course by ID (client-side)
export async function getCourseById(courseId: string): Promise<CourseWithStudents | null> {
  const supabase = createClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (error) {
    console.error("Error fetching course:", error?.message || JSON.stringify(error));
    return null;
  }

  if (!course) {
    return null;
  }

  // Get enrollment count
  const { count } = await supabase
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId);

  // Get professor name from users table
  let professorName = "Unknown Professor";
  try {
    const { data: professor } = await supabase
      .from("professors")
      .select("user_id")
      .eq("id", course.professor_id)
      .maybeSingle();
    
    if (professor?.user_id) {
      const { data: user } = await supabase
        .from("users")
        .select("name")
        .eq("id", professor.user_id)
        .maybeSingle();
      professorName = user?.name || "Unknown Professor";
    }
  } catch (err) {
    console.warn("Error fetching professor name:", err);
  }

  const [
    { count: lessonsCount },
    { count: assignmentsCount },
    { count: quizzesCount },
      ] = await Promise.all([
        supabase
          .from("lessons")
          .select("*", { count: "exact", head: true })
          .eq("course_id", courseId),
        supabase
          .from("assignments")
          .select("*", { count: "exact", head: true })
          .eq("course_id", courseId),
        supabase
          .from("quizzes")
          .select("*", { count: "exact", head: true })
          .eq("course_id", courseId),
      ]);

      return {
        ...course,
        students: [],
        studentsCount: count || 0,
        professorName,
        lessonsCount: lessonsCount || 0,
        assignmentsCount: assignmentsCount || 0,
        quizzesCount: quizzesCount || 0,
      };
    }
// Course creation is now admin-only. Professors cannot create courses from the client.
// This stub is kept only so existing imports (including older call sites) compile; it will always throw at runtime.
export async function createCourse(
  _courseName: string,
  _professorId: string,
  _professorName: string
): Promise<never> {
  throw new Error("Course creation is admin-only. Please ask an admin to create the course.");
}

// Get student's enrolled courses (client-side)
export async function getStudentCourses(studentId: string): Promise<CourseWithStudents[]> {
  const supabase = createClient();

  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select(`
      *, courses(
      id,
      name,
      code,
      professor_id,
      created_at
      )
    `)
    .eq("student_id", studentId);

  if (error) {
    console.error("Error fetching student courses:", error);
    throw error;
  }

  if (!enrollments || enrollments.length === 0) {
    return [];
  }

  // Get professor names for each course
  const coursesWithDetails = await Promise.all(
    enrollments.map(async (enrollment: any) => {
      const course = enrollment.courses;
      if (!course) return null;

      // Get professor name from users table
      let professorName = "Unknown Professor";
      try {
        const { data: professor } = await supabase
          .from("professors")
          .select("user_id")
          .eq("id", course.professor_id)
          .maybeSingle();
        
        if (professor?.user_id) {
          const { data: user } = await supabase
            .from("users")
            .select("name")
            .eq("id", professor.user_id)
            .maybeSingle();
          professorName = user?.name || "Unknown Professor";
        }
      } catch (err) {
        console.warn("Error fetching professor name:", err);
      }

      const { count } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("course_id", course.id);

  // Get counts
  const [
    { count: lessonsCount },
    { count: assignmentsCount },
    { count: quizzesCount },
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("course_id", course.id),

    supabase
      .from("assignments")
      .select("*", { count: "exact", head: true })
      .eq("course_id", course.id),

    supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("course_id", course.id),
  ]);

  return {
    ...course,
    professorName,
    students: [],
    studentsCount: count || 0,
    lessonsCount: lessonsCount || 0,
    assignmentsCount: assignmentsCount || 0,
    quizzesCount: quizzesCount || 0,
  };
    }));
  return coursesWithDetails.filter((c) => c !== null) as CourseWithStudents[];
}

// Get course students (client-side)
export async function getCourseStudents(courseId: string) {
  const supabase = createClient();

  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select("*, students(*)")
    .eq("course_id", courseId);

  if (error) {
    console.error("Error fetching course students:", error?.message || error);
    throw error;
  }

  if (!enrollments || enrollments.length === 0) {
    return [];
  }

  const studentIds = [...new Set((enrollments as any[]).map((e) => e.students?.user_id).filter(Boolean))] as string[];
  let userMap: Record<string, { name: string; email: string }> = {};
  if (studentIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", studentIds);
    if (users) {
      userMap = Object.fromEntries(users.map((u: any) => [u.id, { name: u.name || "Unknown", email: u.email || "" }]));
    }
  }

  return (enrollments as any[]).map((enrollment) => {
    const student = enrollment.students;
    const userInfo = student?.user_id ? userMap[student.user_id] : null;
    return {
      id: student?.user_id || enrollment.student_id,
      name: userInfo?.name || "Unknown Student",
      email: userInfo?.email || "",
      studentId: student?.student_id || "",
      /** students table id - use for getStudentGrades(courseId, studentDbId) */
      studentDbId: enrollment.student_id,
      enrolledAt: enrollment.enrolled_at || enrollment.created_at,
    };
  });
}

// Generate a unique invite code (e.g. ABC1234)
function generateInviteCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // No I, O to avoid confusion
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  code += String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return code;
}

// Get the invite link for a course (client-side; use in browser)
export function getInviteLink(classroomCode: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/student/join?code=${encodeURIComponent(classroomCode)}`;
}

// Course updates (name/code, invite code) are now admin-only and handled via admin APIs.

// Join course by classroom code (client-side)
export async function joinCourseByCode(classroomCode: string, studentId: string) {
  // Enrollment is admin-managed; students cannot self-enroll.
  throw new Error("Joining courses is disabled. Please contact your admin to be enrolled.");

}

// Remove a single student from a course (unenroll).
// Uses the students table id (studentDbId) stored in enrollments.student_id.
export async function removeStudentFromCourse(courseId: string, studentDbId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("course_id", courseId)
    .eq("student_id", studentDbId);

  if (error) {
    console.error("Error removing student from course:", error);
    throw error;
  }
}

// Course deletion and cascading cleanup are now admin-only and handled via admin APIs.

// Get current user ID from auth (client-side)
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

// Get current professor ID (client-side)
// Optionally creates professor record if it doesn't exist
export async function getCurrentProfessorId(createIfMissing: boolean = false): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.warn("No user ID found - user may not be logged in");
    return null;
  }

  const supabase = createClient();
  let { data: professor, error } = await supabase
    .from("professors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching professor record:", error);
    return null;
  }

  // If professor doesn't exist and we should create it
  if (!professor && createIfMissing) {
    const { data: newProfessor, error: createError } = await supabase
      .from("professors")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (createError) {
      console.error("Error creating professor record:", createError);
      return null;
    }

    professor = newProfessor;
  }

  if (!professor) {
    console.warn(`No professor record found for user_id: ${userId}. User may need to sign up as a professor.`);
    return null;
  }

  return professor.id;
}

// Get current student ID (client-side)
export async function getCurrentStudentId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return student?.id || null;
}

