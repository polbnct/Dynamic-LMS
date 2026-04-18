"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById, getCurrentStudentId } from "@/lib/supabase/queries/courses.client";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";
import CourseAnnouncementsSection from "@/components/courses/CourseAnnouncementsSection";
import {
  getAnnouncementsWithCommentsForCourse,
  addComment,
  deleteComment,
  type AnnouncementWithComments,
} from "@/lib/supabase/queries/announcements";

export default function StudentCourseAnnouncementsPage() {
  const params = useParams();
  const rawId = params.id as string | undefined;
  const courseId = typeof rawId === "string" && rawId !== "undefined" ? rawId : "";

  const [course, setCourse] = useState<any>(null);
  const [items, setItems] = useState<AnnouncementWithComments[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useSyncMessagesToToast(error, success);

  const load = useCallback(async () => {
    if (!courseId) return;
    const data = await getAnnouncementsWithCommentsForCourse(courseId);
    setItems(data);
  }, [courseId]);

  useEffect(() => {
    async function init() {
      if (!courseId) {
        setLoading(false);
        return;
      }
      try {
        const [courseData, sid] = await Promise.all([
          getCourseById(courseId),
          getCurrentStudentId(),
        ]);
        setCourse(courseData);
        setStudentId(sid);
        await load();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [courseId, load]);

  const handleAddComment = async (announcementId: string, body: string) => {
    setError("");
    setSuccess("");
    try {
      await addComment(announcementId, body);
      setSuccess("Comment posted.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post comment.");
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
        <StudentNavbar currentPage="courses" />
        <StudentCourseNavbar courseId={courseId} currentPage="announcements" />
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
      <StudentNavbar currentPage="courses" />
      <StudentCourseNavbar
        courseId={courseId}
        currentPage="announcements"
        courseName={course?.name}
        courseCode={course?.code}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <div className="mb-8">
          <Link
            href="/student/dashboard"
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
          mode="student"
          items={items}
          currentStudentId={studentId}
          onCreateAnnouncement={async (_title: string, _body: string, _files: File[]) => {}}
          onUpdateAnnouncement={async (
            _id: string,
            _title: string,
            _body: string,
            _opts?: { newFiles?: File[] }
          ) => {}}
          onDeleteAnnouncement={async (_id: string) => {}}
          onDeleteAttachment={async (_attachmentId: string) => {}}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
        />
      </main>
    </div>
  );
}
