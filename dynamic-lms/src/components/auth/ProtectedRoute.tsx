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
    let cancelled = false;

    async function checkAuth() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (authError) {
          console.error("ProtectedRoute getUser:", authError.message);
        }

        // Only treat missing user as logged out — not DB/network errors from role lookups.
        if (!user) {
          router.push("/login");
          return;
        }

        if (requiredRole === "professor") {
          const { data: profData, error: profError } = await supabase
            .from("professors")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (cancelled) return;
          if (profError) {
            console.error("ProtectedRoute professors:", profError.message);
            setLoading(false);
            return;
          }

          if (profData) {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          const { data: userData, error: userRowError } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (cancelled) return;
          if (userRowError) {
            console.error("ProtectedRoute users (prof):", userRowError.message);
            setLoading(false);
            return;
          }

          if (userData?.role === "professor") {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          router.push("/student/dashboard");
        } else {
          const { data: studentData, error: studentError } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (cancelled) return;
          if (studentError) {
            console.error("ProtectedRoute students:", studentError.message);
            setLoading(false);
            return;
          }

          if (studentData) {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          const { data: userData, error: userRowError } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (cancelled) return;
          if (userRowError) {
            console.error("ProtectedRoute users (student):", userRowError.message);
            setLoading(false);
            return;
          }

          if (userData?.role === "student") {
            setAuthorized(true);
            setLoading(false);
            return;
          }

          router.push("/prof");
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (!cancelled) setLoading(false);
        // Do not send users to login on unexpected errors (often transient / RLS / network).
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router, requiredRole, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-rose-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
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

