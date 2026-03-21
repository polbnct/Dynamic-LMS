"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

async function getServerRole(): Promise<string | null> {
  const res = await fetch("/api/auth/role", { method: "GET" });
  const data = await res.json().catch(() => ({}));
  return (data as any)?.role ?? null;
}

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Check if user is already logged in
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Prefer admin role first
        const role = await getServerRole();
        if (role === "admin") {
          router.push("/admin");
          return;
        }

        // Check user role by profile tables
        const { data: profData } = await supabase
          .from("professors")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profData) {
          router.push("/prof");
          return;
        }

        const { data: studentData } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (studentData) {
          router.push("/student/dashboard");
          return;
        }
      }
    }

    checkAuth();
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!email || !password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Failed to sign in. Please check your credentials.");
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Failed to sign in. Please try again.");
        setLoading(false);
        return;
      }

      // Prefer admin role first
      const role = await getServerRole();
      if (role === "admin") {
        router.push("/admin");
        return;
      }

      // Check user role by looking in professors/students tables
      const { data: profData } = await supabase
        .from("professors")
        .select("id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      // Get redirect URL from query params if available
      const redirectUrl = searchParams.get("redirect");

      if (profData) {
        router.push(redirectUrl && redirectUrl.startsWith("/prof") ? redirectUrl : "/prof");
        return;
      }

      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (studentData) {
        router.push(redirectUrl && redirectUrl.startsWith("/student") ? redirectUrl : "/student/dashboard");
        return;
      }

      if (role) {
        if (role === "professor" || role === "prof") {
          router.push(redirectUrl && redirectUrl.startsWith("/prof") ? redirectUrl : "/prof");
        } else {
          router.push(redirectUrl && redirectUrl.startsWith("/student") ? redirectUrl : "/student/dashboard");
        }
        return;
      }

      setError("User role not found. Please contact support.");
      setLoading(false);
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="grid min-h-[84vh] lg:grid-cols-2">
          <section className="flex items-center justify-center px-5 py-8 sm:px-10">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Welcome to our Learning Management System</h1>
                <p className="mt-2 text-sm text-gray-600">Sign in to continue to your academic dashboard.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

              <div className="my-6 h-px w-full bg-gray-200" />

              <p className="text-center text-sm text-gray-600">
                Don't have an account?{" "}
                <Link href="/signup" className="font-semibold text-red-600 hover:text-red-700 transition-colors">
                  Sign up
                </Link>
              </p>
            </div>
          </section>

          <section className="relative hidden lg:block">
            <img
              src="/images/login-side.jpg"
              alt="Campus academic environment"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 rounded-xl border border-white/20 bg-black/35 p-5 text-white backdrop-blur-sm">
              <h2 className="text-xl font-semibold">Academic Excellence Starts Here</h2>
              <p className="mt-2 text-sm text-white/90">
                Replace this image by adding your photo at
                <span className="ml-1 font-semibold">`/public/images/login-side.jpg`</span>.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
