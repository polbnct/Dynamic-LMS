"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentCoursesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-red-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
