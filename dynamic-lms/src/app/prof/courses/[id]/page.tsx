"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CourseDetailPage() {
  // Redirect to classlist as default page
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params.id) {
      router.push(`/prof/courses/${params.id}/classlist`);
    }
  }, [params.id, router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );
}
