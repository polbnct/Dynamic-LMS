import { createClient } from "../client";

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  category: "prelim" | "midterm" | "finals";
  order: number;
  pdf_file_path?: string;
  created_at: string;
}

// Get lessons for a course
export async function getLessons(courseId: string): Promise<Lesson[]> {
  const supabase = createClient();

  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("order", { ascending: true });

  if (error) {
    console.error("Error fetching lessons:", error);
    throw error;
  }

  return lessons || [];
}

// Create a new lesson
export async function createLesson(
  courseId: string,
  lessonData: {
    title: string;
    description?: string;
    category: "prelim" | "midterm" | "finals";
    pdf_file_path?: string;
    order: number;
  }
): Promise<Lesson> {
  const supabase = createClient();

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      ...lessonData,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating lesson:", error);
    throw error;
  }

  return lesson;
}

// Update a lesson
export async function updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<Lesson> {
  const supabase = createClient();

  const { data: lesson, error } = await supabase
    .from("lessons")
    .update(updates)
    .eq("id", lessonId)
    .select()
    .single();

  if (error) {
    console.error("Error updating lesson:", error);
    throw error;
  }

  return lesson;
}

// Delete a lesson
export async function deleteLesson(lessonId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

  if (error) {
    console.error("Error deleting lesson:", error);
    throw error;
  }
}

// Upload PDF to Supabase Storage
export async function uploadLessonPDF(file: File, courseId: string, lessonId: string): Promise<string> {
  const supabase = createClient();

  const fileExt = file.name.split(".").pop();
  const fileName = `${courseId}/${lessonId}-${Date.now()}.${fileExt}`;
  const filePath = `lessons/${fileName}`;

  const { error: uploadError } = await supabase.storage.from("lesson-pdfs").upload(filePath, file);

  if (uploadError) {
    console.error("Error uploading PDF:", uploadError);
    throw uploadError;
  }

  return filePath;
}

// Get public URL for lesson PDF
export function getLessonPDFUrl(filePath: string): string {
  const supabase = createClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from("lesson-pdfs").getPublicUrl(filePath);
  return publicUrl;
}

