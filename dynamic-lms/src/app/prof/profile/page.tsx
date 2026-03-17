"use client";

import React, { useEffect, useState } from "react";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { createClient } from "@/lib/supabase/client";

interface ProfileData {
  name: string;
  email: string;
}

export default function ProfProfile() {
  const { handledCourses } = useProfessorCourses();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const fetchProfile = async () => {
    const supabase = createClient();
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in.");
        return;
      }

      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", user.id)
        .single();

      if (userError || !userRow) {
        setProfile({
          name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "",
          email: user.email ?? "",
        });
        return;
      }

      setProfile({
        name: userRow.name ?? "",
        email: userRow.email ?? user.email ?? "",
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const startEditing = () => {
    if (profile) {
      setEditName(profile.name);
      setEditEmail(profile.email);
      setEditing(true);
      setError("");
      setSuccess("");
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError("");
    setSuccess("");
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in.");
        setSaving(false);
        return;
      }

      const name = editName.trim();
      const email = editEmail.trim().toLowerCase();
      if (!name) {
        setError("Name is required.");
        setSaving(false);
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Please enter a valid email.");
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({ name, email })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message || "Failed to update profile.");
        setSaving(false);
        return;
      }

      if (email !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({ email });
        if (authError) {
          setError(authError.message || "Profile updated but email change may require verification.");
        }
      }

      setProfile({ name, email });
      setEditing(false);
      setSuccess("Profile updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordSaving) return;

    setPasswordError("");
    setPasswordSuccess("");

    const currentPassword = passwordForm.currentPassword;
    const newPassword = passwordForm.newPassword;
    const confirmNewPassword = passwordForm.confirmNewPassword;

    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in your current password and new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    const supabase = createClient();
    try {
      setPasswordSaving(true);
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user?.email) {
        setPasswordError("Could not determine your email for re-authentication.");
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInErr) {
        setPasswordError(signInErr.message || "Current password is incorrect.");
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        setPasswordError(updateErr.message || "Failed to update password.");
        return;
      }

      setPasswordSuccess("Password updated successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (err: any) {
      console.error("Error updating password:", err);
      setPasswordError(err?.message || "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <ProfessorNavbar currentPage="profile" handledCourses={handledCourses} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Profile Settings
          </h1>
          <p className="text-gray-600">Manage your account information</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm">
            {success}
          </div>
        )}

        {loading ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8 flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : editing ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Profile</h2>
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label htmlFor="profile-name" className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                <input
                  id="profile-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="profile-email" className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Personal Information</h2>
                <button
                  type="button"
                  onClick={startEditing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                  <div className="font-semibold text-xl text-gray-800">{profile?.name ?? "—"}</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <div className="text-gray-700">{profile?.email ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Change Password</h2>

              {passwordError && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm">
                  {passwordSuccess}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div>
                  <label htmlFor="prof-current-password" className="block text-sm font-semibold text-gray-700 mb-2">
                    Current password
                  </label>
                  <input
                    id="prof-current-password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label htmlFor="prof-new-password" className="block text-sm font-semibold text-gray-700 mb-2">
                    New password
                  </label>
                  <input
                    id="prof-new-password"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="prof-confirm-new-password" className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm new password
                  </label>
                  <input
                    id="prof-confirm-new-password"
                    type="password"
                    value={passwordForm.confirmNewPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirmNewPassword: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordSaving ? "Updating..." : "Update password"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
