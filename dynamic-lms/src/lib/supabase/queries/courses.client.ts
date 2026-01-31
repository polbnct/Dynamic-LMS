import { createClient } from "../client";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  professorName?: string;
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
  };
}

// Create new course (client-side)
export async function createCourse(
  courseName: string,
  professorId: string,
  professorName: string
): Promise<CourseWithStudents> {
  const supabase = createClient();

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
    professorName,
  };
}

// Get student's enrolled courses (client-side)
export async function getStudentCourses(studentId: string): Promise<CourseWithStudents[]> {
  const supabase = createClient();

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

      // Get enrollment count
      const { count } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", course.id);

      return {
        ...course,
        professorName,
        students: [],
        studentsCount: count || 0,
      };
    })
  );

  return coursesWithDetails.filter((c) => c !== null) as CourseWithStudents[];
}

// Get course students (client-side)
export async function getCourseStudents(courseId: string) {
  const supabase = createClient();

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

// Join course by classroom code (client-side)
export async function joinCourseByCode(classroomCode: string, studentId: string) {
  const supabase = createClient();

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

