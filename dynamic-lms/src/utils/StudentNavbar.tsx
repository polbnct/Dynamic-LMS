"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useStudentCourses } from "@/contexts/StudentCoursesContext";

interface StudentNavbarProps {
  currentPage?: "profile" | "courses" | "dashboard";
  onJoinCourse?: () => void;
}

export default function StudentNavbar({ currentPage = "dashboard", onJoinCourse }: StudentNavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileCoursesOpen, setMobileCoursesOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileName, setProfileName] = useState("");
  const { courses, loading } = useStudentCourses();

  useEffect(() => {
    const loadNavbarProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: userRow }, { data: studentRow }] = await Promise.all([
          supabase.from("users").select("name").eq("id", user.id).maybeSingle(),
          supabase
            .from("students")
            .select("profile_image_url")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        setProfileName((userRow as any)?.name || user.user_metadata?.name || "");
        setProfileImageUrl((studentRow as any)?.profile_image_url || "");
      } catch (err) {
        console.error("Failed to load student navbar profile:", err);
      }
    };

    loadNavbarProfile();
  }, [supabase]);

  const profileInitial = (profileName || "S").charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
        alert("Failed to logout. Please try again.");
      } else {
        router.push("/login");
      }
    } catch (err) {
      console.error("Logout error:", err);
      alert("Failed to logout. Please try again.");
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-rose-100 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo Section */}
          <Link href="/student" className={`flex min-w-0 items-center gap-2 transition-opacity duration-200 ${
            mobileMenuOpen ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}>
              <img
                src="/logo.png"
                alt="Logo"
                className="w-10 h-10 rounded-xl shadow-lg"
              />
              <span className="hidden sm:inline text-xl font-bold text-gray-900 truncate">
                LohikAral
              </span>
            </Link>

          {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center gap-2 lg:gap-4">
              {/* Dashboard */}
              <Link
                href="/student"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  currentPage === "dashboard"
                    ? "text-red-600 bg-red-50"
                    : "text-gray-700 hover:text-red-600 hover:bg-red-50"
                }`}
              >
                Dashboard
              </Link>

            {/* Courses Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCoursesDropdownOpen(!coursesDropdownOpen)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  currentPage === "courses" ? "text-red-600 bg-red-50" : "text-gray-700 hover:text-red-600 hover:bg-red-50"
                }`}
              >
                <span>Courses</span>
                <svg className={`w-4 h-4 transition-transform ${coursesDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {coursesDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCoursesDropdownOpen(false)}></div>
                  <div className="absolute right-0 z-50 mt-2 w-[90vw] max-w-sm sm:max-w-md overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-2xl">
                    <div className="border-b border-rose-100 bg-gradient-to-r from-rose-50 to-red-50 p-4">
                      <h3 className="font-bold text-lg text-gray-900">My Courses</h3>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="p-3 border-b border-rose-100">
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search by course name or code"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-rose-200 rounded-lg shadow:sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                      {loading ? (
                        <div className="p-8 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-red-500"></div></div>
                      ) : (
                        <div className="divide-y divide-rose-50">
                          {courses.filter((course) => {
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            return course.name.toLowerCase().includes(query) || 
                                  course.code.toLowerCase().includes(query);
                          }).length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                              No courses found
                            </div>
                          ) : (
                            courses.filter((course) => {
                              if (!searchQuery) return true;
                              const query = searchQuery.toLowerCase();
                              return course.name.toLowerCase().includes(query) || 
                                    course.code.toLowerCase().includes(query);
                            }).map((course) => (
                              <Link 
                                key={course.id} 
                                href={`/student/dashboard/${course.id}/content`} 
                                onClick={() => setCoursesDropdownOpen(false)}
                                className="block p-4 hover:bg-rose-50"
                              >
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-gray-800 truncate" title={course.name}>{course.name}</h4>
                                  <span className="text-gray-400">•</span>
                                  <p className="text-sm text-gray-600 truncate" title={course.code}>{course.code}</p>
                                </div>
                              </Link>     
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Link
              href="/student/profile"
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                currentPage === "profile" ? "text-red-600 bg-red-50" : "text-gray-700 hover:text-red-600 hover:bg-red-50"
              }`}
            >
              {profileImageUrl ? (
                <img src={profileImageUrl} alt="profile" className="w-6 h-6 rounded-full object-cover border border-red-100" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center border border-red-200">
                  {profileInitial}
                </span>
              )}
              Profile
            </Link>

            <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50">
              <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              Logout
            </button>
          </div>

          {/* Hamburger Menu Button (Mobile Only) */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-rose-50 hover:text-red-600 transition-colors"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
        <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 md:hidden transition-opacity duration-300
          ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Right Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 max-w-[80%] z-50 bg-white shadow-2xl border-l border-rose-100 transform transition-transform duration-300 ease-in-out md:hidden
          ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-rose-100">
          <div className="flex items-center gap-3 min-w-0">
            {/* Profile Avatar on the left */}
            {profileImageUrl ? (
              <img 
                src={profileImageUrl} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover border-2 border-rose-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-base font-bold flex items-center justify-center shadow-md">
                {profileInitial}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {profileName || "Student"}
              </span>
              <span className="text-xs text-gray-500 truncate">
                Student
              </span>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-rose-50 text-gray-900"
          >
            ✕
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          <Link
            href="/student"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:text-red-600 hover:bg-rose-50"
          >
            Dashboard
          </Link>

          <button
            onClick={() => {
              setMobileCoursesOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:text-red-600 hover:bg-rose-50"
          >
            <span>Courses</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <Link
            href="/student/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:text-red-600 hover:bg-rose-50"
          >
            Profile
          </Link>

          <hr className="border-rose-100" />

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-red-600 hover:bg-rose-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
        </div>
      </>

      {/* Courses Drawer (Mobile) */}
      <div
        className={`fixed inset-0 z-50 bg-black/20 transition-opacity duration-300 md:hidden
          ${mobileCoursesOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileCoursesOpen(false)}
      />

      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85%] z-50 bg-white shadow-2xl border-l border-rose-100 transform transition-transform duration-300 ease-in-out md:hidden
          ${mobileCoursesOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-rose-100">
          <button
            onClick={() => setMobileCoursesOpen(false)}
            className="p-2 rounded-lg hover:bg-rose-50 text-gray-900 mt-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-bold text-gray-900">My Courses</span>
          <div className="w-10"></div> {/* Spacer for alignment */}
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-rose-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or code"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-rose-200 rounded-lg focus:outline-none text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Courses List */}
        <div className="flex-1 overflow-y-auto h-[calc(100%-130px)]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-red-500"></div>
            </div>
          ) : (
            <div className="divide-y divide-rose-50">
              {courses.filter((course) => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return course.name.toLowerCase().includes(query) || 
                       course.code.toLowerCase().includes(query);
              }).length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No courses found
                </div>
              ) : (
                courses.filter((course) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return course.name.toLowerCase().includes(query) || 
                         course.code.toLowerCase().includes(query);
                }).map((course) => (
                  <Link 
                    key={course.id} 
                    href={`/student/dashboard/${course.id}/content`} 
                    onClick={() => {
                      setMobileCoursesOpen(false);
                      setMobileMenuOpen(false);
                      setSearchQuery("");
                    }}
                    className="block p-4 hover:bg-rose-50"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800 truncate" title={course.name}>{course.name}</h4>
                      <span className="text-gray-400">•</span>
                      <p className="text-sm text-gray-600 truncate" title={course.code}>{course.code}</p>
                    </div>
                  </Link>     
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}