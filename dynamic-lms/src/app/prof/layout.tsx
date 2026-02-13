"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute requiredRole="professor">{children}</ProtectedRoute>;
}

