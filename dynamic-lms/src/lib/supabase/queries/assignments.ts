import { createClient } from "../client";

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  category: "prelim" | "midterm" | "finals";
  pdf_file_path?: string;
  due_date?: string;
  created_at: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_path?: string;
  submitted_at: string;
  score?: number;
  max_score: number;
  graded_at?: string;
  feedback?: string;
}

// Get assignments for a course
export async function getAssignments(courseId: string): Promise<Assignment[]> {
  const supabase = createClient();

  const { data: assignments, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching assignments:", error);
    throw error;
  }

  return assignments || [];
}

// Create a new assignment
export async function createAssignment(
  courseId: string,
  assignmentData: {
    title: string;
    description?: string;
    category: "prelim" | "midterm" | "finals";
    pdf_file_path?: string;
    due_date?: string;
  }
): Promise<Assignment> {
  const supabase = createClient();

  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      course_id: courseId,
      ...assignmentData,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating assignment:", error);
    throw error;
  }

  return assignment;
}

// Update an assignment
export async function updateAssignment(assignmentId: string, updates: Partial<Assignment>): Promise<Assignment> {
  const supabase = createClient();

  const { data: assignment, error } = await supabase
    .from("assignments")
    .update(updates)
    .eq("id", assignmentId)
    .select()
    .single();

  if (error) {
    console.error("Error updating assignment:", error);
    throw error;
  }

  return assignment;
}

// Delete an assignment
export async function deleteAssignment(assignmentId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);

  if (error) {
    console.error("Error deleting assignment:", error);
    throw error;
  }
}

// Get student submissions for assignments
export async function getAssignmentSubmissions(studentId: string, assignmentIds: string[]): Promise<AssignmentSubmission[]> {
  const supabase = createClient();

  const { data: submissions, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("student_id", studentId)
    .in("assignment_id", assignmentIds);

  if (error) {
    console.error("Error fetching submissions:", error);
    throw error;
  }

  return submissions || [];
}

// Submit an assignment
export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  file: File
): Promise<AssignmentSubmission> {
  const supabase = createClient();

  // Upload file
  const fileExt = file.name.split(".").pop();
  const fileName = `${assignmentId}/${studentId}-${Date.now()}.${fileExt}`;
  const filePath = `submissions/${fileName}`;

  const { error: uploadError } = await supabase.storage.from("assignment-submissions").upload(filePath, file);

  if (uploadError) {
    console.error("Error uploading submission:", uploadError);
    
    // Provide helpful error message for bucket not found
    if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
      const helpfulError = new Error(
        "Storage bucket 'assignment-submissions' not found. Please create it in Supabase Dashboard > Storage. " +
        "The bucket should be named 'assignment-submissions' and set to public."
      );
      (helpfulError as any).code = uploadError.code;
      (helpfulError as any).originalError = uploadError;
      throw helpfulError;
    }
    
    throw uploadError;
  }

  // Get max score from assignment
  const { data: assignment } = await supabase.from("assignments").select("id").eq("id", assignmentId).single();

  // Create submission record
  const { data: submission, error: submitError } = await supabase
    .from("assignment_submissions")
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      file_path: filePath,
      submitted_at: new Date().toISOString(),
      max_score: 100, // Default, should come from assignment
    })
    .select()
    .single();

  if (submitError) {
    console.error("Error creating submission:", submitError);
    throw submitError;
  }

  return submission;
}

// Upload assignment PDF
export async function uploadAssignmentPDF(file: File, courseId: string, assignmentId: string): Promise<string> {
  const supabase = createClient();

  const fileExt = file.name.split(".").pop();
  const fileName = `${courseId}/${assignmentId}-${Date.now()}.${fileExt}`;
  const filePath = `assignments/${fileName}`;

  const { error: uploadError } = await supabase.storage.from("assignment-pdfs").upload(filePath, file);

  if (uploadError) {
    console.error("Error uploading PDF:", uploadError);
    
    // Provide helpful error message for bucket not found
    if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
      const helpfulError = new Error(
        "Storage bucket 'assignment-pdfs' not found. Please create it in Supabase Dashboard > Storage. " +
        "The bucket should be named 'assignment-pdfs' and set to public."
      );
      (helpfulError as any).code = uploadError.code;
      (helpfulError as any).originalError = uploadError;
      throw helpfulError;
    }
    
    throw uploadError;
  }

  return filePath;
}

// Get public URL for assignment PDF
export function getAssignmentPDFUrl(filePath: string): string {
  const supabase = createClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from("assignment-pdfs").getPublicUrl(filePath);
  return publicUrl;
}

// Get public URL for submission file
export function getSubmissionFileUrl(filePath: string): string {
  const supabase = createClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from("assignment-submissions").getPublicUrl(filePath);
  return publicUrl;
}

/** Submission with student display info for professor view */
export interface SubmissionWithStudent extends AssignmentSubmission {
  studentName?: string;
  studentEmail?: string;
  fileUrl?: string;
  fileName?: string;
}

/** Get all submissions for an assignment (for professor). Includes student name/email and file URL. */
export async function getSubmissionsByAssignmentId(assignmentId: string): Promise<SubmissionWithStudent[]> {
  const supabase = createClient();

  const { data: rows, error } = await supabase
    .from("assignment_submissions")
    .select(`
      id,
      assignment_id,
      student_id,
      file_path,
      submitted_at,
      score,
      max_score,
      graded_at,
      feedback,
      students (
        id,
        user_id,
        users ( name, email )
      )
    `)
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Error fetching assignment submissions:", error);
    throw error;
  }

  const submissions: SubmissionWithStudent[] = (rows || []).map((row: any) => {
    const student = row.students;
    const user = student && (Array.isArray(student.users) ? student.users[0] : student.users);
    const filePath = row.file_path;
    return {
      id: row.id,
      assignment_id: row.assignment_id,
      student_id: row.student_id,
      file_path: filePath,
      submitted_at: row.submitted_at,
      score: row.score,
      max_score: row.max_score,
      graded_at: row.graded_at,
      feedback: row.feedback,
      studentName: user?.name ?? "Unknown Student",
      studentEmail: user?.email ?? "",
      fileUrl: filePath ? getSubmissionFileUrl(filePath) : undefined,
      fileName: filePath ? filePath.split("/").pop() : undefined,
    };
  });

  return submissions;
}

/** Update a submission's grade (score, max_score, feedback). Sets graded_at to now. */
export async function updateAssignmentSubmission(
  submissionId: string,
  updates: { score: number; max_score?: number; feedback?: string }
): Promise<AssignmentSubmission> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assignment_submissions")
    .update({
      score: updates.score,
      ...(updates.max_score != null && { max_score: updates.max_score }),
      ...(updates.feedback != null && { feedback: updates.feedback }),
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select()
    .single();

  if (error) {
    console.error("Error updating submission grade:", error);
    throw error;
  }

  return data;
}

