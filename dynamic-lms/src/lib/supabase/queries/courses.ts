import { createClient } from "../server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface Course {
  id: string;
  name: string;
  code: string;
  classroom_code: string;
  professor_id: string;
  created_at: string;
  studentsCount?: number;
}

export interface CourseWithStudents extends Course {
  students: any[];
  studentsCount: number;
}

// Get professor's courses
export async function getProfessorCourses(professorId: string): Promise<CourseWithStudents[]> {
  const supabase = await createClient();

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

  // Get enrollment counts for each course
  const coursesWithCounts = await Promise.all(
    courses.map(async (course) => {
      const { count } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", course.id);

      return {
        ...course,
        students: [],
        studentsCount: count || 0,
      };
    })
  );

  return coursesWithCounts;
}

// Get course by ID
export async function getCourseById(courseId: string): Promise<CourseWithStudents | null> {
  const supabase = await createClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (error) {
    console.error("Error fetching course:", error);
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

  return {
    ...course,
    students: [],
    studentsCount: count || 0,
  };
}

// Create new course
export async function createCourse(
  courseName: string,
  professorId: string,
  professorName: string
): Promise<CourseWithStudents> {
  const supabase = await createClient();

  // Generate course code (simple implementation)
  const code = `CS${Math.floor(Math.random() * 900) + 100}`;
  const classroomCode = courseName.substring(0, 3).toUpperCase() + String(Math.floor(Math.random() * 1000));

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      name: courseName,
      code,
      classroom_code: classroomCode,
      professor_id: professorId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating course:", error);
    throw error;
  }

  return {
    ...course,
    students: [],
    studentsCount: 0,
  };
}

// Get student's enrolled courses
export async function getStudentCourses(studentId: string): Promise<CourseWithStudents[]> {
  const supabase = await createClient();

  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select("*, courses(*)")
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

      // Get professor info
      const { data: professor } = await supabase
        .from("professors")
        .select("*, users(name)")
        .eq("user_id", course.professor_id)
        .single();

      // Get enrollment count
      const { count } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", course.id);

      return {
        ...course,
        professorName: professor?.users?.name || "Unknown Professor",
        students: [],
        studentsCount: count || 0,
      };
    })
  );

  return coursesWithDetails.filter((c) => c !== null) as CourseWithStudents[];
}

// Get course students
export async function getCourseStudents(courseId: string) {
  const supabase = await createClient();

  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select("*, students(*, users(*))")
    .eq("course_id", courseId);

  if (error) {
    console.error("Error fetching course students:", error);
    throw error;
  }

  if (!enrollments) {
    return [];
  }

  return enrollments.map((enrollment: any) => ({
    id: enrollment.students?.user_id || enrollment.student_id,
    name: enrollment.students?.users?.name || "Unknown Student",
    email: enrollment.students?.users?.email || "",
    studentId: enrollment.students?.student_id || "",
    enrolledAt: enrollment.enrolled_at || enrollment.created_at,
  }));
}

// Join course by classroom code
export async function joinCourseByCode(classroomCode: string, studentId: string) {
  const supabase = await createClient();

  // Find course by classroom code
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id")
    .eq("classroom_code", classroomCode)
    .single();

  if (courseError || !course) {
    throw new Error("Invalid classroom code");
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", course.id)
    .eq("student_id", studentId)
    .single();

  if (existing) {
    throw new Error("Already enrolled in this course");
  }

  // Create enrollment
  const { error: enrollError } = await supabase.from("enrollments").insert({
    course_id: course.id,
    student_id: studentId,
  });

  if (enrollError) {
    console.error("Error joining course:", enrollError);
    throw enrollError;
  }

  return course;
}

// Get current user ID from auth
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

// Get current professor ID
export async function getCurrentProfessorId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: professor } = await supabase
    .from("professors")
    .select("id")
    .eq("user_id", userId)
    .single();

  return professor?.id || null;
}

// Get current student ID
export async function getCurrentStudentId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .single();

  return student?.id || null;
}

