"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ProfessorCoursesProvider } from "@/contexts/ProfessorCoursesContext";

export default function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="professor">
      <ProfessorCoursesProvider>{children}</ProfessorCoursesProvider>
    </ProtectedRoute>
  );
}

