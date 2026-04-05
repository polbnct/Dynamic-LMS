"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StudentNavbar from "@/utils/StudentNavbar";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";

export default function StudentProfile() {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    studentId: "",
    phone: "",
    year: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [toastError, setToastError] = useState("");
  const showErrorToast = (message: string) => {
  setToastError("");
  setTimeout(() => {
    setToastError(message);
    }, 0);
  };
  const [isEditing, setIsEditing] = useState(false);

  useSyncMessagesToToast(toastError, success);

  // Load current student profile from Supabase (users + students tables)
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return;
        }

        const { data: userRow } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", user.id)
          .maybeSingle();

        const { data: studentRow } = await supabase
          .from("students")
          .select("student_id, phone, graduation_year")
          .eq("user_id", user.id)
          .maybeSingle();

        setFormData((prev) => ({
          ...prev,
          name: userRow?.name || user.user_metadata?.name || "",
          email: userRow?.email || user.email || "",
          studentId: studentRow?.student_id || "",
          phone: (studentRow as any)?.phone || "",
          year: (studentRow as any)?.graduation_year || "",
        }));
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value,
    });
    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const validateProfileForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required.";
    }

    if (!formData.studentId.trim()) {
      newErrors.studentId = "Student ID is required.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    if (!passwordData.currentPassword.trim()) {
      showErrorToast("Current password is required.");
      return false;
    }

    if (!passwordData.newPassword.trim()) {
      showErrorToast("New password is required.");
      return false;
    }

    if (passwordData.newPassword.length < 8) {
      showErrorToast("Password must be at least 8 characters long.");
      return false;
    }

    if (!/[A-Z]/.test(passwordData.newPassword)) {
       showErrorToast("Password must include at least one uppercase letter.");
      return false;
    }

    if (!/[^A-Za-z0-9]/.test(passwordData.newPassword)) {
       showErrorToast("Password must include at least one symbol.");
      return false;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
       showErrorToast("New password must be different from the old password.");
      return false;
    }

    if (!passwordData.confirmPassword.trim()) {
       showErrorToast("Please confirm your new password.");
      return false;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
       showErrorToast("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");

    if (!validateProfileForm()) {
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      const trimmedName = formData.name.trim();

        const { error: authMetaError } = await supabase.auth.updateUser({
          data: { name: trimmedName },
        });

        if (authMetaError) {
          throw authMetaError;
        }

      const { error: userError } = await supabase
        .from("users")
        .update({
          name: trimmedName,
        })
        .eq("id", user.id);
      if (userError) {
        throw userError;
      }

      const studentUpdates: Record<string, any> = {
        student_id: formData.studentId.trim(),
        phone: formData.phone.trim(),
        graduation_year: formData.year.trim(),
      };

      const { error: studentError } = await supabase
        .from("students")
        .update(studentUpdates)
        .eq("user_id", user.id);

      if (studentError) {
        throw studentError;
      }

      const { data: refreshedUserRow } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", user.id)
        .maybeSingle();

      setFormData((prev) => ({
        ...prev,
        name: refreshedUserRow?.name || trimmedName,
        email: refreshedUserRow?.email || prev.email,
      }));

      setSuccess("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      setErrors((prev) => ({
        ...prev,
        form: err?.message || "Failed to update profile.",
      }));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setToastError("");
    setErrors({});

    if (!validatePasswordForm()) {
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;
      if (!email) {
        throw new Error("Not authenticated");
      }

      // Re-authenticate using current password to ensure it's correct
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: passwordData.currentPassword,
      });
      if (signInErr) {
        showErrorToast("Current password is incorrect")
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      if (updateErr) {
        throw updateErr;
      }

      setSuccess("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordSection(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Failed to change password:", err);
      setErrors((prev) => ({
        ...prev,
        form: err?.message || "Failed to change password.",
      }));
    }
  };

      const handleCancel = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: userRow } = await supabase
            .from("users")
            .select("name, email")
            .eq("id", user.id)
            .maybeSingle();

          const { data: studentRow } = await supabase
            .from("students")
            .select("student_id, phone, graduation_year")
            .eq("user_id", user.id)
            .maybeSingle();

          setFormData({
            name: userRow?.name || user.user_metadata?.name || "",
            email: userRow?.email || user.email || "",
            studentId: studentRow?.student_id || "",
            phone: (studentRow as any)?.phone || "",
            year: (studentRow as any)?.graduation_year || "",
          });
        }
      } catch (err) {
        console.error("Failed to reset profile form:", err);
      }

      setIsEditing(false);
      setShowPasswordSection(false);
      setErrors({});
      setSuccess("");
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      {/* Navbar */}
      <StudentNavbar currentPage="profile" />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        {loadingProfile && (
          <div className="mb-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600" />
              <span className="text-sm font-semibold">Loading profile…</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Profile Settings
          </h1>
          <p className="text-gray-600">Manage your account information and preferences</p>
        </div>

        {/* Profile Information Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 lg:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 min-w-0 break-words">Personal Information</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors cursor-pointer"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Profile
              </button>
            )}
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Full Name */}
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
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-gray-800 placeholder-text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                      isEditing
                        ? "border-gray-300 bg-gray-50/50 focus:bg-white"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed"
                    }`}
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Email */}
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
                    onChange={handleInputChange}
                    disabled
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-800 bg-gray-100 cursor-not-allowed">
                  </input>
                </div>
              </div>

              {/* Student ID */}
              <div>
                <label htmlFor="studentId" className="block text-sm font-semibold text-gray-700 mb-2">
                  Student ID
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
                        d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                      />
                    </svg>
                  </div>
                  <input
                    id="studentId"
                    name="studentId"
                    type="text"
                    value={formData.studentId}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-gray-800 placeholder-text-gray-600  focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                      isEditing
                        ? "border-gray-300 bg-gray-50/50 focus:bg-white"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed"
                    } ${errors.studentId ? "border-red-300" : ""}`}
                  />
                </div>
                {errors.studentId && (
                  <p className="mt-1 text-sm text-red-600">{errors.studentId}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
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
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-gray-800 placeholder-text-gray-600  focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                      isEditing
                        ? "border-gray-300 bg-gray-50/50 focus:bg-white"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed"
                    } ${errors.phone ? "border-red-300" : ""}`}
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>

              {/* Year */}
              <div>
                <label htmlFor="year" className="block text-sm font-semibold text-gray-700 mb-2">
                  Graduation Year
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <input
                    id="year"
                    name="year"
                    type="text"
                    value={formData.year}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-gray-800 placeholder-text-gray-600  focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                      isEditing
                        ? "border-gray-300 bg-gray-50/50 focus:bg-white"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold shadow-lg transition-all duration-75 hover:from-red-500 hover:to-rose-500 cursor-pointer"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-800 rounded-xl font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
            {!isEditing && (
              <div className="pt-4 border-t border-gray-200 sm:hidden">
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors cursor-pointer"
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit Profile
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Password Change Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Password</h2>
              <p className="text-sm text-gray-600 mt-1">
                Change your password to keep your account secure
              </p>
            </div>
            {!showPasswordSection && (
              <button
                onClick={() => setShowPasswordSection(true)}
                className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors cursor-pointer "
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
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                Change Password
              </button>
            )}
          </div>

          {showPasswordSection && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                {/* Current Password */}
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Current Password
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
                      id="currentPassword"
                      name="currentPassword"
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className={`w-full pl-10 pr-16 py-3 border rounded-xl text-gray-800 placeholder-text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 border-gray-300 bg-gray-50/50 focus:bg-white ${
                        errors.currentPassword ? "border-red-300" : ""
                      }`}
                      placeholder="Enter your current password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords((p) => ({ ...p, current: !p.current }))
                      }
                      className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-sm text-gray-500"
                    >
                      {showPasswords.current ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    New Password
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
                      id="newPassword"
                      name="newPassword"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className={`w-full pl-10 pr-16 py-3 border rounded-xl text-gray-800 placeholder-text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 border-gray-300 bg-gray-50/50 focus:bg-white ${
                        errors.newPassword ? "border-red-300" : ""
                      }`}
                      placeholder="Enter your new password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords((p) => ({ ...p, new: !p.new }))
                      }
                      className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-sm text-gray-500"
                    >
                      {showPasswords.new ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Confirm New Password
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
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className={`w-full pl-10 pr-16 py-3 border rounded-xl text-gray-800 placeholder-text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 border-gray-300 bg-gray-50/50 focus:bg-white ${
                        errors.confirmPassword ? "border-red-300" : ""
                      }`}
                      placeholder="Confirm your new password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))
                      }
                      className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-sm text-gray-500"
                    >
                      {showPasswords.confirm ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold shadow-lg transition-all duration-75 cursor-pointer hover:from-red-500 hover:to-rose-500"
                >
                  Update Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setPasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setErrors({});
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-800 rounded-xl font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
