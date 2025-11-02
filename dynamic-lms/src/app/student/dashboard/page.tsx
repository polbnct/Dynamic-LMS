"use client";

import React from "react";

const COURSES = [
  {
    name: "Discrete Structures",
    code: "CS101",
    progress: 60, // percent complete
    hasNewQuiz: true,
    icon: "📖",
  },
];

export default function StudentDashboard() {
  return (
    <div className="flex min-h-screen bg-red-50">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-white border-r border-red-200 p-6 shadow-md min-h-screen">
        <div className="flex flex-col gap-6 flex-1">
          <SidebarNavItem icon="🏠" label="Dashboard" active />
          <SidebarNavItem icon="📚" label="My Courses" />
          <SidebarNavItem icon="👤" label="Profile" />
        </div>
        <button className="flex items-center gap-3 text-red-600 font-semibold hover:text-red-800 mt-10">
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </aside>
      {/* Main */}
      <main className="flex-1 px-12 py-10">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Hello, John! Let's get learning.</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-7 mt-10">
          {COURSES.map((course, idx) => (
            <div key={idx} className="relative h-44 bg-white border border-red-200 rounded-2xl shadow flex flex-col justify-between p-6 hover:shadow-lg transition">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{course.icon}</span>
                <div>
                  <span className="block font-bold text-xl text-red-700">{course.name}</span>
                  <span className="block text-red-400 text-sm">{course.code}</span>
                </div>
                {course.hasNewQuiz && (
                  <span className="ml-3 text-xs bg-red-600 text-white rounded-full px-3 py-1">New Quiz!</span>
                )}
              </div>
              <div className="mt-4">
                <div className="w-full bg-red-100 rounded-full h-2 mb-1">
                  <div style={{ width: course.progress + '%' }} className="bg-red-400 h-2 rounded-full" />
                </div>
                <div className="text-xs text-red-500">Progress: {course.progress}%</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function SidebarNavItem({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <a
      href="#"
      className={
        "flex items-center gap-3 py-2 px-4 rounded-lg font-medium text-lg " +
        (active ? "bg-red-100 text-red-700" : "text-red-500 hover:bg-red-50 hover:text-red-700")
      }
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}



