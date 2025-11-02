"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function StudentCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  useEffect(() => {
    // Redirect to content page as default
    router.replace(`/student/courses/${courseId}/content`);
  }, [courseId, router]);

  return null;
}

