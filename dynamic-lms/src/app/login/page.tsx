"use client";

import React, { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Dummy validation
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError("");
    // TODO: Add real authentication logic here
    alert("Logged in! (stub)");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-red-50">
      <div className="w-full max-w-md border border-red-200 rounded-2xl shadow-lg bg-white p-8">
        <h1 className="mb-2 text-3xl font-bold text-red-600 text-center">LMS Login</h1>
        <p className="mb-8 text-center text-red-400">Access your learning dashboard</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="font-medium text-red-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="rounded-lg border border-red-200 p-2 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200/50 transition"
            autoComplete="email"
          />
          <label className="font-medium text-red-700 mt-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="rounded-lg border border-red-200 p-2 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200/50 transition"
            autoComplete="current-password"
          />
          {error && (
            <div className="text-red-500 bg-red-100 rounded px-2 py-1 text-sm mt-2">{error}</div>
          )}
          <button
            type="submit"
            className="mt-6 rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 transition"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}


