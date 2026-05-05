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

  const { data: lesson, error: fetchError } = await supabase
    .from("lessons")
    .select("pdf_file_path")
    .eq("id", lessonId)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching lesson before delete:", fetchError);
    throw fetchError;
  }

  if (lesson?.pdf_file_path) {
    const { error: storageError } = await supabase
      .storage
      .from("lesson-pdfs")
      .remove([lesson.pdf_file_path]);

    if (storageError) {
      console.error("Error deleting lesson PDF from storage:", storageError);
      throw storageError;
    }
  }

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

  if (error) {
    console.error("Error deleting lesson:", error);
    throw error;
  }
}

// Sanitize original filename for storage (keep same name as professor uploaded)
function sanitizeLessonPDFFileName(originalName: string): string {
  const base = originalName.replace(/^.*[\\/]/, "").trim() || "document";
  const sanitized = base.replace(/[^\w\s.-]/gi, "").replace(/\s+/g, " ").trim().slice(0, 200);
  const hasExt = /\.(pdf|PDF)$/.test(sanitized);
  return hasExt ? sanitized : `${sanitized}.pdf`;
}

// Upload PDF to Supabase Storage (persistent path: courseId/lessonId/original-filename.pdf)
export async function uploadLessonPDF(file: File, courseId: string, lessonId: string): Promise<string> {
  const supabase = createClient();

  const fileName = sanitizeLessonPDFFileName(file.name);
  const filePath = `lessons/${courseId}/${lessonId}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from("lesson-pdfs").upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Error uploading PDF:", uploadError);
    
    // Provide helpful error message for bucket not found
    if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
      const helpfulError = new Error(
        "Storage bucket 'lesson-pdfs' not found. Please create it in Supabase Dashboard > Storage. " +
        "The bucket should be named 'lesson-pdfs' and set to public."
      );
      (helpfulError as any).code = (uploadError as any).code;
      (helpfulError as any).originalError = uploadError;
      throw helpfulError;
    }
    
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

