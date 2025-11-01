"use client";

import React from "react";

export default function ProfProfile() {
  return (
    <div className="min-h-screen bg-red-50">
      {/* Navbar (horizontal, matches prof/page.tsx) */}
      <nav className="bg-white border-b border-red-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <span className="text-2xl font-bold text-red-600">Professor LMS</span>
        <div className="flex gap-6 text-red-600 font-medium">
          <a href="#" className="hover:text-red-800">Dashboard</a>
          <a href="#" className="hover:text-red-800">Students</a>
          <a href="#" className="text-red-700 font-bold underline">Profile</a>
        </div>
        <button className="text-red-600 font-semibold hover:text-red-800">Logout</button>
      </nav>
      {/* Main */}
      <main className="px-12 py-10">
        <h1 className="text-3xl font-bold text-red-600 mb-8">Profile</h1>
        <div className="bg-white shadow border border-red-200 rounded-2xl p-8 w-full max-w-lg">
          <div className="mb-6">
            <div className="font-semibold text-xl text-red-700">Jane Doe</div>
            <div className="text-gray-500">jane.doe@university.edu</div>
          </div>
          <button className="px-6 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition">Edit Profile</button>
        </div>
      </main>
    </div>
  );
}
