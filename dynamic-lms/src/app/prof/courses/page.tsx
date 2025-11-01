"use client";

import React from "react";

const COURSES = [
  {
    name: "Discrete Structures",
    code: "CS101",
    materials: 4,
  },
];

export default function ProfCourses() {
  return (
    <div className="min-h-screen bg-red-50">
      {/* Navbar (horizontal, matches prof/page.tsx) */}
      <nav className="bg-white border-b border-red-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <span className="text-2xl font-bold text-red-600">Professor LMS</span>
        <div className="flex gap-6 text-red-600 font-medium">
          <a href="#" className="hover:text-red-800">Dashboard</a>
          <a href="#" className="hover:text-red-800">Students</a>
          <a href="#" className="hover:text-red-800">Profile</a>
        </div>
        <button className="text-red-600 font-semibold hover:text-red-800">Logout</button>
      </nav>
      {/* Main */}
      <main className="px-12 py-10">
        <h1 className="text-3xl font-bold text-red-600 mb-8">My Courses</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 mt-10">
          {COURSES.map((course, idx) => (
            <div key={idx} className="h-44 bg-white border border-red-200 rounded-2xl shadow flex flex-col justify-between p-6 hover:shadow-lg transition">
              <div className="mb-3">
                <span className="block font-bold text-xl text-red-700">{course.name}</span>
                <span className="block text-red-400 text-sm">{course.code}</span>
              </div>
              <div className="text-red-500 text-sm">{course.materials} Materials</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
