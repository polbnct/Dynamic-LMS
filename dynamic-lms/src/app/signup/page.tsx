"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const[showPassword, setShowPassword] = useState(false);
  const[showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `STU${year}${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setLoading(false);
      setError("Please fill in all fields.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    if (!isValidEmail) {
      setLoading(false);
      setError("Please enter a valid email address.");
      return;
    }

    const password = formData.password;

    const hasUppercase = /[A-Z]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const hasMinLength = password.length >= 8;

    if (!hasMinLength) {
      setLoading(false);
      setError("Password must be at least 8 characters long!");
      return;
    }

    if (!hasUppercase && !hasSymbol) {
      setLoading(false);
      setError("Password must include at least 1 uppercase and 1 symbol!");
      return;
    }

    if (!hasUppercase) {
      setLoading(false);
      setError("Password must include at least 1 uppercase!");
      return;
    }

    if (!hasSymbol) {
      setLoading(false);
      setError("Password must include at least 1 symbol!");
      return;
    }

    try {
      // Use API route for signup to handle server-side operations
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: "student",
        }),
      });

      // Log response details first
      console.log("API Response status:", response.status);
      console.log("API Response statusText:", response.statusText);
      console.log("API Response headers:", Object.fromEntries(response.headers.entries()));
      
      let data: any = {};
      let responseText = "";
      
      try {
        responseText = await response.text();
        console.log("Raw API response text:", responseText);
        console.log("Response text length:", responseText.length);
        
        if (!responseText || responseText.trim() === "") {
          console.error("Empty response from server");
          setError(`Server returned empty response (${response.status}). Please check your server logs.`);
          setLoading(false);
          return;
        }
        
        try {
          data = JSON.parse(responseText);
          console.log("Parsed API response:", JSON.stringify(data, null, 2));
        } catch (jsonError: any) {
          console.error("Failed to parse JSON:", jsonError);
          console.error("Response was:", responseText);
          setError(`Server returned invalid JSON. Status: ${response.status}. Please check server logs.`);
          setLoading(false);
          return;
        }
      } catch (parseError: any) {
        console.error("Failed to read response:", parseError);
        setError(`Server error: ${parseError?.message || "Failed to read response"}. Please try again.`);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        // Show detailed error message (use string values so they display in console)
        const errorMessage = 
          (typeof data?.error === "string" ? data.error : null) ||
          (typeof data?.message === "string" ? data.message : null) ||
          (typeof data?.originalError === "string" ? data.originalError : null) ||
          (typeof data?.details === "string" ? data.details : null) ||
          `Failed to create account (${response.status} ${response.statusText}). Please try again.`;
        
        console.error("Signup API error - status:", response.status, "statusText:", response.statusText);
        console.error("Signup API error - response body:", responseText);
        console.error("Signup API error - error message:", data?.error ?? data?.message ?? "(none)");
        
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // User should be automatically logged in after signup
      // If we have a session from the API, use it
      if (data.session) {
        router.push("/student/dashboard");
        return;
      }

      // If no session from API, try to sign in immediately
      // This should work since email confirmation is disabled
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        console.error("Auto-login error:", signInError);
        setSuccess("Account created successfully! Please log in.");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
        setLoading(false);
        return;
      }

      if (signInData.user && signInData.session) {
        router.push("/student/dashboard");
        return;
      }

      setSuccess("Account created successfully! Please log in.");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
      setLoading(false);
    } catch (err: any) {
      console.error("Signup error:", err);
      console.error("Error details:", {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
        cause: err?.cause,
      });
      
      const errorMessage = err?.message || err?.toString() || "An unexpected error occurred. Please try again.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden items-center justify-center bg-[#f8f8f8] py-12 px-4 sm:px-6 lg:px-8">
     <div className="relative w-full max-w-md mx-4">
      {/* Main card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
        
        {/* Logo/Branding section */}
        <div className="text-center mb-6">

          {/* Logo + Name */}
          <div className="mx-auto mb-4 h-14 w-14 flex items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-8 h-8 object-contain"
            />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Account
          </h1>

          {/* Subtitle */}
          <p className="text-gray-500 text-sm">
            Sign up below and begin your learning experience
          </p>

        </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  maxLength={64}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  maxLength={64}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  maxLength={64}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                  className="w-full pl-10 pr-16 py-3 border border-gray-300 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Confirm Password field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  maxLength={64}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  className="w-full pl-10 pr-16 py-3 border border-gray-300 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword? "Hide" : "Show"}
                </button>
              </div>
                {error && (
                  <p className="mt-1 text-sm text-red-500">{error}</p>
                )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-red-300 mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500">or</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Sign in link */}
          <p className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-red-600 hover:text-red-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

