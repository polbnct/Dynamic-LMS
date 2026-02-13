"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import StudentNavbar from "@/utils/StudentNavbar";
import { getCurrentStudentId, joinCourseByCode } from "@/lib/supabase/queries/courses.client";

export default function StudentJoinCoursePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code")?.trim() ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (codeFromUrl) setCode(codeFromUrl);
  }, [codeFromUrl]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter an invite code.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const studentId = await getCurrentStudentId();
      if (!studentId) {
        setError("You must be logged in as a student to join a course.");
        setLoading(false);
        return;
      }
      await joinCourseByCode(trimmed, studentId);
      setSuccess("You have joined the course!");
      setCode("");
      setTimeout(() => router.push("/student/courses"), 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to join course. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-red-50">
      <StudentNavbar currentPage="courses" />
      <main className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-rose-100 p-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-700 via-rose-600 to-red-500 bg-clip-text text-transparent mb-2">
            Join a course
          </h1>
          <p className="text-gray-600 text-sm mb-6">
            Enter the invite code your professor shared, or use a join link they sent.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-semibold text-gray-700 mb-2">
                Invite code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC1234"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent font-mono text-lg tracking-wide"
                maxLength={20}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-3 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Joining…" : "Join course"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              {success}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/student/courses" className="text-rose-600 hover:underline">
              ← Back to my courses
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
