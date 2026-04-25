"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface HandledCourse {
  id: string;
  name: string;
  code: string;
  studentsCount?: number;
}

interface ProfessorNavbarProps {
  currentPage?: "profile" | "courses" | "dashboard";
  handledCourses?: HandledCourse[];
}

export default function ProfessorNavbar({
  currentPage,
  handledCourses = [],
}: ProfessorNavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileCoursesOpen, setMobileCoursesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileName, setProfileName] = useState("");
  const [sortedCourses, setSortedCourses] = useState<HandledCourse[]>([]);

  useEffect(() => {
    const loadNavbarProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: userRow }, { data: professorRow }] = await Promise.all([
          supabase.from("users").select("name").eq("id", user.id).maybeSingle(),
          supabase
            .from("professors")
            .select("profile_image_url")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        setProfileName((userRow as any)?.name || user.user_metadata?.name || "");
        setProfileImageUrl((professorRow as any)?.profile_image_url || "");
      } catch (err) {
        console.error("Failed to load professor navbar profile:", err);
      }
    };

    loadNavbarProfile();
  }, [supabase]);

    useEffect(() => {
    if (handledCourses.length === 0) return;
    
    const lastAccessed = localStorage.getItem("lastAccessedCourse");
    
    const sorted = [...handledCourses].sort((a, b) => {
      if (a.id === lastAccessed) return -1;
      if (b.id === lastAccessed) return 1;
      return a.name.localeCompare(b.name);
    });
    
    setSortedCourses(sorted);
  }, [handledCourses]);

  const profileInitial = (profileName || "P").charAt(0).toUpperCase();

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
    <>
      {/* Modern Navbar */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo */}
            <Link href="/prof" className={`flex min-w-0 items-center gap-2 transition-opacity duration-200 ${
                  mobileMenuOpen ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              >
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
                href="/prof"
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
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    currentPage === "courses"
                      ? "text-red-600 bg-red-50"
                      : "text-gray-700 hover:text-red-600 hover:bg-red-50"
                  }`}
                >
                  <span>Courses</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${coursesDropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Modal */}
                {coursesDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setCoursesDropdownOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-[90vw] max-w-sm sm:max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-rose-50">
                        <h3 className="font-bold text-lg text-gray-800">Handled Courses</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {handledCourses.length} course{handledCourses.length !== 1 ? "s" : ""} you manage
                        </p>
                      </div>
                      
                      {/* Search Bar */}
                      <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="text"
                            placeholder="Search by course name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-gray-800 placeholder:text-gray-400"
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
                        {handledCourses.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <p>No courses yet. Create your first course!</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {sortedCourses.filter((course) => {
                              if (!searchQuery) return true;
                              const query = searchQuery.toLowerCase();
                              return course.name.toLowerCase().includes(query) || 
                                    course.code.toLowerCase().includes(query);
                            }).length === 0 ? (
                              <div className="p-8 text-center text-gray-500">
                                No courses found
                              </div>
                            ) : (
                              sortedCourses.filter((course) => {
                                if (!searchQuery) return true;
                                const query = searchQuery.toLowerCase();
                                return course.name.toLowerCase().includes(query) || 
                                      course.code.toLowerCase().includes(query);
                              }).map((course) => (
                                <Link
                                  key={course.id}
                                  href={`/prof/courses/${course.id}`}
                                  onClick={() => {
                                    setCoursesDropdownOpen(false);
                                    setSearchQuery("");
                                    localStorage.setItem("lastAccessedCourse", course.id);
                                  }}
                                  className="block p-4 hover:bg-red-50 transition-colors"
                                >
                                  <div>
                                    {/* Course name and code on same line with dot */}
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold text-gray-800 truncate" title={course.name}>
                                        {course.name}
                                      </h4>
                                      <span className="text-gray-400">•</span>
                                      <p className="text-sm text-gray-600 truncate" title={course.code}>
                                        {course.code}
                                      </p>
                                    </div>
                                    {/* Student count below */}
                                    {course.studentsCount !== undefined && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        {course.studentsCount} student{course.studentsCount !== 1 ? "s" : ""}
                                      </p>
                                    )}
                                  </div>
                                </Link>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <div className="p-4 border-t border-gray-200 bg-gray-50">
                        <div className="text-xs text-gray-500 text-center">
                          Course creation is managed by an admin.
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Profile */}
              <Link
                href="/prof/profile"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2 ${
                  currentPage === "profile"
                    ? "text-red-600 bg-red-50"
                    : "text-gray-700 hover:text-red-600 hover:bg-red-50"
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

              {/* Logout */}
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
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

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="p-2 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <>
        <div
          className={`fixed inset-0 z-40 bg-black/20 md:hidden transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        <div
          className={`fixed top-0 right-0 h-full w-72 max-w-[80%] z-50 bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 ease-in-out md:hidden ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3 min-w-0">
              {/* Profile Avatar on the left */}
              {profileImageUrl ? (
                <img 
                  src={profileImageUrl} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-red-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-base font-bold flex items-center justify-center shadow-md">
                  {profileInitial}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {profileName || "Professor"}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  Professor
                </span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-2">
            <Link
              href="/prof"
              className="block rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>

            <button
              onClick={() => {
                setMobileCoursesOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600"
            >
              <span>Courses</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

              <Link
              href="/prof/profile"
              className="rounded-lg px-4 py-3 text-base font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Profile
            </Link>
            
            <hr className="border-gray-200" />

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-red-600 hover:bg-red-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </>

       {/* Course creation is admin-managed (no professor modal). */}

      {/* Courses Drawer (Mobile) */}
      <div
        className={`fixed inset-0 z-50 bg-black/20 transition-opacity duration-300 md:hidden
          ${mobileCoursesOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileCoursesOpen(false)}
      />

      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85%] z-50 bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 ease-in-out md:hidden
          ${mobileCoursesOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <button
            onClick={() => setMobileCoursesOpen(false)}
            className="p-2 rounded-lg hover:bg-red-50 text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-bold text-gray-900">Handled Courses</span>
          <div className="w-10"></div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
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
          {sortedCourses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No courses yet. Create your first course!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedCourses.filter((course) => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return course.name.toLowerCase().includes(query) || 
                      course.code.toLowerCase().includes(query);
              }).length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No courses found
                </div>
              ) : (
                sortedCourses.filter((course) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return course.name.toLowerCase().includes(query) || 
                        course.code.toLowerCase().includes(query);
                }).map((course) => (
                  <Link 
                    key={course.id} 
                    href={`/prof/courses/${course.id}`} 
                    onClick={() => {
                      setMobileCoursesOpen(false);
                      setMobileMenuOpen(false);
                      setSearchQuery("");
                      localStorage.setItem("lastAccessedCourse", course.id);
                    }}
                    className="block p-4 hover:bg-red-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-800 truncate" title={course.name}>
                          {course.name}
                        </h4>
                        <span className="text-gray-400">•</span>
                        <p className="text-sm text-gray-600 truncate" title={course.code}>
                          {course.code}
                        </p>
                      </div>
                      {course.studentsCount !== undefined && (
                        <p className="text-xs text-gray-500 mt-1">
                          {course.studentsCount} student{course.studentsCount !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </Link>     
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

