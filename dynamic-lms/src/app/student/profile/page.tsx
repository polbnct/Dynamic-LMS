"use client";

import React from "react";

export default function StudentProfile() {
  return (
    <div className="flex min-h-screen bg-red-50">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-white border-r border-red-200 p-6 shadow-md min-h-screen">
        <div className="flex flex-col gap-6 flex-1">
          <SidebarNavItem label="Dashboard" />
          <SidebarNavItem label="My Courses" />
          <SidebarNavItem label="Profile" active />
        </div>
        <button className="mt-10 text-red-600 font-semibold hover:text-red-800">Logout</button>
      </aside>
      {/* Main */}
      <main className="flex-1 px-12 py-10">
        <h1 className="text-3xl font-bold text-red-600 mb-8">Profile</h1>
        <div className="bg-white shadow border border-red-200 rounded-2xl p-8 w-full max-w-lg">
          <div className="mb-6">
            <div className="font-semibold text-xl text-red-700">John Doe</div>
            <div className="text-gray-500">john.doe@student.edu</div>
          </div>
          <button className="px-6 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition">Edit Profile</button>
        </div>
      </main>
    </div>
  );
}

function SidebarNavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <a
      href="#"
      className={
        "py-2 px-4 rounded-lg font-medium text-lg text-left " +
        (active ? "bg-red-100 text-red-700" : "text-red-500 hover:bg-red-50 hover:text-red-700")
      }
    >
      {label}
    </a>
  );
}



