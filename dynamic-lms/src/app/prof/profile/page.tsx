"use client";

import React, { useState, useEffect } from "react";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import { getProfessorCourses, getCurrentProfessorId } from "@/lib/mockData/courses";

export default function ProfProfile() {
  const [handledCourses, setHandledCourses] = useState([]);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const professorId = getCurrentProfessorId();
        const courses = await getProfessorCourses(professorId);
        setHandledCourses(
          courses.map((course) => ({
            id: parseInt(course.id),
            name: course.name,
            code: course.code,
            studentsCount: course.studentsCount,
          }))
        );
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    }
    fetchCourses();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Professor Navbar */}
      <ProfessorNavbar currentPage="profile" handledCourses={handledCourses} />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Profile Settings
          </h1>
          <p className="text-gray-600">Manage your account information and preferences</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Personal Information</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit Profile
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <div className="font-semibold text-xl text-gray-800">Jane Doe</div>
              <div className="text-gray-500 mt-1">jane.doe@university.edu</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Department
                </label>
                <div className="text-gray-800">Computer Science</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title
                </label>
                <div className="text-gray-800">Associate Professor</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
