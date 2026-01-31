"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: "professor" | "student";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        // Check if user is authenticated
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Check user role
        if (requiredRole === "professor") {
          const { data: profData } = await supabase
            .from("professors")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profData) {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          // Check users table as fallback
          const { data: userData } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (userData?.role === "professor") {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          // Not a professor, redirect to student dashboard
          router.push("/student/dashboard");
        } else {
          // Required role is student
          const { data: studentData } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (studentData) {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          // Check users table as fallback
          const { data: userData } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (userData?.role === "student") {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          // Not a student, redirect to professor dashboard
          router.push("/prof");
        }
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/login");
      }
    }

    checkAuth();
  }, [router, requiredRole, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}

