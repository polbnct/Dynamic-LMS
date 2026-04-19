import { createClient } from "../client";
import { getCurrentProfessorId, getCurrentStudentId } from "./courses.client";

function toDebugError(err: unknown) {
  if (!err || typeof err !== "object") return { value: err };
  const anyErr = err as Record<string, unknown>;
  return {
    name: anyErr?.name,
    message: anyErr?.message,
    code: anyErr?.code,
    details: anyErr?.details,
    hint: anyErr?.hint,
    status: anyErr?.status,
    statusCode: anyErr?.statusCode,
  };
}

export interface CourseAnnouncement {
  id: string;
  course_id: string;
  professor_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at?: string | null;
}

export interface AnnouncementComment {
  id: string;
  announcement_id: string;
  student_id: string;
  body: string;
  created_at: string;
}

/** Supabase Storage bucket (create as public in Dashboard, like assignment-pdfs). */
export const ANNOUNCEMENT_FILES_BUCKET = "announcement-files";

export interface AnnouncementAttachment {
  id: string;
  announcement_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

export type AnnouncementAttachmentWithUrl = AnnouncementAttachment & { download_url: string };

export interface AnnouncementWithComments {
  announcement: CourseAnnouncement & { professor_name: string };
  comments: (AnnouncementComment & { student_name: string })[];
  attachments: AnnouncementAttachmentWithUrl[];
}

function sanitizeStorageFileName(name: string): string {
  const trimmed = name.trim() || "file";
  return trimmed.replace(/[^\w.\-]+/g, "_").slice(0, 180);
}

export function getAnnouncementFilePublicUrl(filePath: string): string {
  const supabase = createClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from(ANNOUNCEMENT_FILES_BUCKET).getPublicUrl(filePath);
  return publicUrl;
}

async function uploadAnnouncementFileToStorage(
  courseId: string,
  announcementId: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const safe = sanitizeStorageFileName(file.name);
  const filePath = `courses/${courseId}/announcements/${announcementId}/${Date.now()}-${safe}`;

  const { error: uploadError } = await supabase.storage
    .from(ANNOUNCEMENT_FILES_BUCKET)
    .upload(filePath, file);

  if (uploadError) {
    console.error("Error uploading announcement file:", uploadError);
    if (
      uploadError.message?.includes("Bucket not found") ||
      uploadError.message?.includes("not found")
    ) {
      throw new Error(
        `Storage bucket '${ANNOUNCEMENT_FILES_BUCKET}' not found. Create it in Supabase Dashboard > Storage and set it to public (same pattern as assignment-pdfs).`
      );
    }
    throw uploadError;
  }

  return filePath;
}

async function removeAnnouncementFilesFromStorage(
  supabase: ReturnType<typeof createClient>,
  filePaths: string[]
): Promise<void> {
  if (filePaths.length === 0) return;
  const { error } = await supabase.storage.from(ANNOUNCEMENT_FILES_BUCKET).remove(filePaths);
  if (error) {
    console.warn("Error removing announcement files from storage:", error);
  }
}

async function namesForProfessorIds(
  supabase: ReturnType<typeof createClient>,
  professorIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (professorIds.length === 0) return map;
  const { data: profs, error } = await supabase
    .from("professors")
    .select("id, user_id")
    .in("id", professorIds);
  if (error || !profs?.length) return map;
  const userIds = [...new Set(profs.map((p) => p.user_id).filter(Boolean))] as string[];
  if (userIds.length === 0) return map;
  const { data: users } = await supabase.from("users").select("id, name").in("id", userIds);
  const userName = new Map((users ?? []).map((u) => [u.id, u.name ?? "Unknown"]));
  for (const p of profs) {
    map.set(p.id, userName.get(p.user_id) ?? "Unknown Professor");
  }
  return map;
}

async function namesForStudentIds(
  supabase: ReturnType<typeof createClient>,
  studentIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (studentIds.length === 0) return map;
  const { data: studs } = await supabase
    .from("students")
    .select("id, user_id")
    .in("id", studentIds);
  if (!studs?.length) return map;
  const userIds = [...new Set(studs.map((s) => s.user_id).filter(Boolean))] as string[];
  if (userIds.length === 0) return map;
  const { data: users } = await supabase.from("users").select("id, name").in("id", userIds);
  const userName = new Map((users ?? []).map((u) => [u.id, u.name ?? "Unknown"]));
  for (const s of studs) {
    map.set(s.id, userName.get(s.user_id) ?? "Unknown Student");
  }
  return map;
}

export async function getAnnouncementsWithCommentsForCourse(
  courseId: string
): Promise<AnnouncementWithComments[]> {
  const supabase = createClient();

  const { data: rows, error } = await supabase
    .from("course_announcements")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching announcements:", error);
    throw error;
  }

  const announcements = (rows ?? []) as CourseAnnouncement[];
  if (announcements.length === 0) return [];

  const annIds = announcements.map((a) => a.id);
  const profNameMap = await namesForProfessorIds(
    supabase,
    [...new Set(announcements.map((a) => a.professor_id))]
  );

  const { data: commentRows, error: cErr } = await supabase
    .from("announcement_comments")
    .select("*")
    .in("announcement_id", annIds)
    .order("created_at", { ascending: true });

  if (cErr) {
    console.error("Error fetching announcement comments:", cErr);
    throw cErr;
  }

  const comments = (commentRows ?? []) as AnnouncementComment[];
  const studentNameMap = await namesForStudentIds(
    supabase,
    [...new Set(comments.map((c) => c.student_id))]
  );

  const byAnn = new Map<string, (AnnouncementComment & { student_name: string })[]>();
  for (const c of comments) {
    const list = byAnn.get(c.announcement_id) ?? [];
    list.push({ ...c, student_name: studentNameMap.get(c.student_id) ?? "Unknown Student" });
    byAnn.set(c.announcement_id, list);
  }

  const { data: attachmentRows, error: attErr } = await supabase
    .from("announcement_attachments")
    .select("*")
    .in("announcement_id", annIds)
    .order("created_at", { ascending: true });

  if (attErr) {
    console.error("Error fetching announcement attachments:", attErr);
    throw attErr;
  }

  const byAnnAtt = new Map<string, AnnouncementAttachmentWithUrl[]>();
  for (const raw of attachmentRows ?? []) {
    const att = raw as AnnouncementAttachment;
    const list = byAnnAtt.get(att.announcement_id) ?? [];
    list.push({
      ...att,
      download_url: getAnnouncementFilePublicUrl(att.file_path),
    });
    byAnnAtt.set(att.announcement_id, list);
  }

  return announcements.map((a) => ({
    announcement: {
      ...a,
      professor_name: profNameMap.get(a.professor_id) ?? "Unknown Professor",
    },
    comments: byAnn.get(a.id) ?? [],
    attachments: byAnnAtt.get(a.id) ?? [],
  }));
}

async function assertProfessorOwnsCourse(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  professorId: string
): Promise<void> {
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, professor_id")
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!course || course.professor_id !== professorId) {
    throw new Error("You do not have permission to manage announcements for this course.");
  }
}

export async function createAnnouncement(
  courseId: string,
  data: { title: string; body: string; files?: File[] }
): Promise<CourseAnnouncement> {
  const supabase = createClient();
  const professorId = await getCurrentProfessorId(true);
  if (!professorId) {
    throw new Error("Professor account not found.");
  }

  await assertProfessorOwnsCourse(supabase, courseId, professorId);

  const title = data.title.trim();
  const body = data.body.trim();
  if (!title || !body) {
    throw new Error("Title and message are required.");
  }

  const { data: row, error } = await supabase
    .from("course_announcements")
    .insert({
      course_id: courseId,
      professor_id: professorId,
      title,
      body,
    })
    .select()
    .single();

  if (error) {
    const debug = toDebugError(error);
    console.error("Error creating announcement:", debug, error);
    const msg =
      typeof debug.message === "string" ? debug.message : "Failed to create announcement.";
    throw new Error(msg);
  }

  const announcement = row as CourseAnnouncement;
  const files = data.files ?? [];
  const uploadedPaths: string[] = [];

  try {
    for (const file of files) {
      const path = await uploadAnnouncementFileToStorage(courseId, announcement.id, file);
      uploadedPaths.push(path);
      const { error: insErr } = await supabase.from("announcement_attachments").insert({
        announcement_id: announcement.id,
        file_path: path,
        file_name: file.name,
      });
      if (insErr) throw insErr;
    }
  } catch (e) {
    await removeAnnouncementFilesFromStorage(supabase, uploadedPaths);
    await supabase.from("course_announcements").delete().eq("id", announcement.id);
    throw e;
  }

  return announcement;
}

export async function deleteAnnouncementAttachment(attachmentId: string): Promise<void> {
  const supabase = createClient();
  const professorId = await getCurrentProfessorId(true);
  if (!professorId) {
    throw new Error("Professor account not found.");
  }

  const { data: att, error: attErr } = await supabase
    .from("announcement_attachments")
    .select("id, announcement_id, file_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (attErr) throw attErr;
  if (!att) throw new Error("Attachment not found.");

  const { data: ann, error: annErr } = await supabase
    .from("course_announcements")
    .select("id, course_id, professor_id")
    .eq("id", att.announcement_id)
    .maybeSingle();

  if (annErr) throw annErr;
  if (!ann) throw new Error("Announcement not found.");
  if (ann.professor_id !== professorId) {
    throw new Error("You can only manage attachments on your own announcements.");
  }

  await assertProfessorOwnsCourse(supabase, ann.course_id, professorId);

  await removeAnnouncementFilesFromStorage(supabase, [att.file_path]);

  const { error: delErr } = await supabase
    .from("announcement_attachments")
    .delete()
    .eq("id", attachmentId);

  if (delErr) {
    console.error("Error deleting announcement attachment row:", delErr);
    throw delErr;
  }
}

export async function updateAnnouncement(
  announcementId: string,
  data: {
    title: string;
    body: string;
    newFiles?: File[];
  }
): Promise<CourseAnnouncement> {
  const supabase = createClient();
  const professorId = await getCurrentProfessorId(true);
  if (!professorId) {
    throw new Error("Professor account not found.");
  }

  const title = data.title.trim();
  const body = data.body.trim();
  if (!title || !body) {
    throw new Error("Title and message are required.");
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("course_announcements")
    .select("id, course_id, professor_id")
    .eq("id", announcementId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error("Announcement not found.");
  if (existing.professor_id !== professorId) {
    throw new Error("You can only edit your own announcements.");
  }

  await assertProfessorOwnsCourse(supabase, existing.course_id, professorId);

  const { data: row, error } = await supabase
    .from("course_announcements")
    .update({
      title,
      body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", announcementId)
    .select()
    .single();

  if (error) {
    const debug = toDebugError(error);
    console.error("Error updating announcement:", debug, error);
    const msg =
      typeof debug.message === "string" ? debug.message : "Failed to update announcement.";
    throw new Error(msg);
  }

  const newFiles = data.newFiles ?? [];
  const uploadedPaths: string[] = [];
  try {
    for (const file of newFiles) {
      const path = await uploadAnnouncementFileToStorage(
        existing.course_id,
        announcementId,
        file
      );
      uploadedPaths.push(path);
      const { error: insErr } = await supabase.from("announcement_attachments").insert({
        announcement_id: announcementId,
        file_path: path,
        file_name: file.name,
      });
      if (insErr) throw insErr;
    }
  } catch (e) {
    await removeAnnouncementFilesFromStorage(supabase, uploadedPaths);
    throw e;
  }

  return row as CourseAnnouncement;
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const supabase = createClient();
  const professorId = await getCurrentProfessorId(true);
  if (!professorId) {
    throw new Error("Professor account not found.");
  }

  const { data: ann, error: fetchErr } = await supabase
    .from("course_announcements")
    .select("id, course_id, professor_id")
    .eq("id", announcementId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!ann) {
    throw new Error("Announcement not found.");
  }
  if (ann.professor_id !== professorId) {
    throw new Error("You can only delete your own announcements.");
  }

  await assertProfessorOwnsCourse(supabase, ann.course_id, professorId);

  const { data: attachmentPaths, error: attFetchErr } = await supabase
    .from("announcement_attachments")
    .select("file_path")
    .eq("announcement_id", announcementId);

  if (attFetchErr) throw attFetchErr;

  const paths = (attachmentPaths ?? []).map((r) => r.file_path).filter(Boolean) as string[];
  await removeAnnouncementFilesFromStorage(supabase, paths);

  const { error } = await supabase.from("course_announcements").delete().eq("id", announcementId);

  if (error) {
    console.error("Error deleting announcement:", error);
    throw error;
  }
}

async function assertStudentEnrolledInCourse(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  studentId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("You must be enrolled in this course to comment.");
  }
}

export async function addComment(
  announcementId: string,
  body: string
): Promise<AnnouncementComment> {
  const supabase = createClient();
  const studentId = await getCurrentStudentId();
  if (!studentId) {
    throw new Error("Student account not found.");
  }

  const text = body.trim();
  if (!text) {
    throw new Error("Comment cannot be empty.");
  }

  const { data: ann, error: aErr } = await supabase
    .from("course_announcements")
    .select("id, course_id")
    .eq("id", announcementId)
    .maybeSingle();

  if (aErr) throw aErr;
  if (!ann) {
    throw new Error("Announcement not found.");
  }

  await assertStudentEnrolledInCourse(supabase, ann.course_id, studentId);

  const { data: row, error } = await supabase
    .from("announcement_comments")
    .insert({
      announcement_id: announcementId,
      student_id: studentId,
      body: text,
    })
    .select()
    .single();

  if (error) {
    const debug = toDebugError(error);
    console.error("Error adding comment:", debug, error);
    const msg = typeof debug.message === "string" ? debug.message : "Failed to post comment.";
    throw new Error(msg);
  }

  return row as AnnouncementComment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const supabase = createClient();

  const { data: comment, error: cErr } = await supabase
    .from("announcement_comments")
    .select("id, announcement_id, student_id")
    .eq("id", commentId)
    .maybeSingle();

  if (cErr) throw cErr;
  if (!comment) {
    throw new Error("Comment not found.");
  }

  const { data: ann, error: aErr } = await supabase
    .from("course_announcements")
    .select("id, course_id, professor_id")
    .eq("id", comment.announcement_id)
    .maybeSingle();

  if (aErr) throw aErr;
  if (!ann) {
    throw new Error("Announcement not found.");
  }

  const studentId = await getCurrentStudentId();
  const professorId = await getCurrentProfessorId(false);

  if (studentId && comment.student_id === studentId) {
    const { error } = await supabase.from("announcement_comments").delete().eq("id", commentId);
    if (error) throw error;
    return;
  }

  if (professorId && ann.professor_id === professorId) {
    await assertProfessorOwnsCourse(supabase, ann.course_id, professorId);
    const { error } = await supabase.from("announcement_comments").delete().eq("id", commentId);
    if (error) throw error;
    return;
  }

  throw new Error("You do not have permission to delete this comment.");
}

export async function updateComment(commentId: string, body: string): Promise<void> {
  const supabase = createClient();

  const text = body.trim();
  if (!text) {
    throw new Error("Comment cannot be empty.");
  }

  const { error } = await supabase
    .from("announcement_comments")
    .update({ body: text })
    .eq("id", commentId);

  if (error) {
    const debug = toDebugError(error);
    console.error("Error updating comment:", debug, error);
    const msg = typeof debug.message === "string" ? debug.message : "Failed to update comment.";
    throw new Error(msg);
  }
}
