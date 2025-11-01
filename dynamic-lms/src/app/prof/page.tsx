"use client";

import React from "react";

export default function ProfessorDashboard() {
  return (
    <div className="min-h-screen bg-red-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-red-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <span className="text-2xl font-bold text-red-600">Professor LMS</span>
        <div className="flex gap-6 text-red-600 font-medium">
          <a href="#" className="hover:text-red-800">Dashboard</a>
          <a href="#" className="hover:text-red-800">Courses</a>
          <a href="#" className="hover:text-red-800">Students</a>
          <a href="#" className="hover:text-red-800">Messages</a>
          <a href="#" className="hover:text-red-800">Profile</a>
        </div>
      </nav>
      {/* Main Content */}
      <main className="flex items-start justify-center pt-12">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-6">Managed Course</h1>
          {/* Discrete Structures course card */}
          <div className="bg-white border border-red-200 rounded-2xl shadow-md p-6 mb-6">
            <span className="block text-lg font-semibold text-red-700">Discrete Structures</span>
            <p className="mt-2 text-red-500">This course covers mathematical logic, set theory, combinatorics, relations, and graphs for CS students.</p>
            <button className="mt-4 px-6 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition">Go to Course Management</button>
          </div>
        </div>
      </main>
    </div>
  );
}
