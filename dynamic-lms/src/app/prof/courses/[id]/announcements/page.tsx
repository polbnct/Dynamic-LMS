"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import CourseNavbar from "@/utils/CourseNavbar";
import { getCourseById } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";
import CourseAnnouncementsSection from "@/components/courses/CourseAnnouncementsSection";
import {
  getAnnouncementsWithCommentsForCourse,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  deleteAnnouncementAttachment,
  deleteComment,
  type AnnouncementWithComments,
} from "@/lib/supabase/queries/announcements";

export default function ProfessorCourseAnnouncementsPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [items, setItems] = useState<AnnouncementWithComments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { handledCourses } = useProfessorCourses();

  useSyncMessagesToToast(error, success);

  const load = useCallback(async () => {
    const data = await getAnnouncementsWithCommentsForCourse(courseId);
    setItems(data);
  }, [courseId]);

  useEffect(() => {
    async function init() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        await load();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [courseId, load]);

  const handleCreate = async (title: string, body: string, files: File[]) => {
    setError("");
    setSuccess("");
    try {
      await createAnnouncement(courseId, { title, body, files });
      setSuccess("Announcement posted.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post announcement.");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setError("");
    setSuccess("");
    try {
      await deleteAnnouncement(id);
      setSuccess("Announcement removed.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete announcement.");
    }
  };

  const handleUpdateAnnouncement = async (
    id: string,
    title: string,
    body: string,
    opts?: { newFiles?: File[] }
  ) => {
    setError("");
    setSuccess("");
    try {
      await updateAnnouncement(id, { title, body, ...opts });
      setSuccess("Announcement updated.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update announcement.");
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    setError("");
    setSuccess("");
    try {
      await deleteAnnouncementAttachment(attachmentId);
      setSuccess("Attachment removed.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove attachment.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setError("");
    setSuccess("");
    try {
      await deleteComment(commentId);
      setSuccess("Comment removed.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove comment.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />
        <CourseNavbar courseId={courseId} currentPage="announcements" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
          </div>
        </main>
      </div>
    );
  }

  const total = items.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />
      <CourseNavbar
        courseId={courseId}
        currentPage="announcements"
        courseName={course?.name}
        courseCode={course?.code}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <div className="mb-8">
          <Link
            href="/prof/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-red-600 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 break-words">
              Announcements
            </h1>
            <p className="text-sm sm:text-base text-gray-600 truncate">
              {course?.name} ({course?.code}) · {total} announcement{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <CourseAnnouncementsSection
          mode="professor"
          items={items}
          currentStudentId={null}
          onCreateAnnouncement={handleCreate}
          onUpdateAnnouncement={handleUpdateAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          onDeleteAttachment={handleDeleteAttachment}
          onAddComment={async () => {}}
          onDeleteComment={handleDeleteComment}
        />
      </main>
    </div>
  );
}
