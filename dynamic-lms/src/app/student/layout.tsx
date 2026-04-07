"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { StudentCoursesProvider } from "@/contexts/StudentCoursesContext";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="student">
      <StudentCoursesProvider>{children}</StudentCoursesProvider>
    </ProtectedRoute>
  );
}

