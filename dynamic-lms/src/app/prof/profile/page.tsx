"use client";

import React, { useEffect, useState } from "react";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { createClient } from "@/lib/supabase/client";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";

interface ProfileData {
  name: string;
  email: string;
}

export default function ProfProfile() {
  const { handledCourses } = useProfessorCourses();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
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

  useSyncMessagesToToast(error, success);
  useSyncMessagesToToast(passwordError, passwordSuccess);

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

      const { data: professorRow } = await supabase
        .from("professors")
        .select("profile_image_url")
        .eq("user_id", user.id)
        .maybeSingle();

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
      setProfileImageUrl((professorRow as any)?.profile_image_url || "");
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

  const validateImageFile = (file: File): string | null => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxBytes = 5 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      return "Please upload a JPG, PNG, or WEBP image.";
    }
    if (file.size > maxBytes) {
      return "Image size must be 5 MB or less.";
    }
    return null;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      e.target.value = "";
      return;
    }

    setUploadingImage(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const sanitizedName = file.name.replace(/\s+/g, "-").toLowerCase();
      const path = `professors/${user.id}/${Date.now()}-${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(path, file, { upsert: false });
      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("professors")
        .update({ profile_image_url: publicUrl })
        .eq("user_id", user.id);
      if (updateError) {
        throw new Error(`Professor profile update failed: ${updateError.message}`);
      }

      setProfileImageUrl(publicUrl);
      setSuccess("Profile photo updated.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Professor image upload error:", err);
      setError(err?.message || "Failed to upload profile image.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = async () => {
    setUploadingImage(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const { error: updateError } = await supabase
        .from("professors")
        .update({ profile_image_url: null })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      setProfileImageUrl("");
      setSuccess("Profile photo removed.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to remove profile image.");
    } finally {
      setUploadingImage(false);
    }
  };

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
    if (!name) {
      setError("Name is required.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ name })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message || "Failed to update profile.");
      setSaving(false);
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { name }
    });
    
    if (authError) {
      console.error("Error updating auth metadata:", authError);
    }

    setProfile({ name, email: profile.email });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-100">
      <ProfessorNavbar currentPage="profile" handledCourses={handledCourses} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Profile Settings
          </h1>
          <p className="text-gray-600">Manage your account information</p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 lg:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex flex-row items-center gap-4 flex-1 min-w-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt="profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-gray-500">
                    {(profile?.name || "P").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 break-words">{profile?.name || "Professor"}</h2>
                <p className="text-xs sm:text-sm text-gray-600 break-words">{profile?.email || "No email"}</p>
                <p className="text-xs text-gray-500 mt-2">Professor Account</p>
              </div>
            </div>

            <div className="flex flex-row sm:flex-col gap-2 mt-1 sm:mt-0">
              <label className="flex-1 sm:w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 cursor-pointer disabled:opacity-50">
                {uploadingImage ? "Uploading..." : "Upload photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
              {profileImageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={uploadingImage}
                  className="flex-1 sm:w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8 flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent" />
          </div>
        ) : editing ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Profile</h2>
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label htmlFor="profile-name" className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                <input
                  id="profile-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="profile-email" className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  value={editEmail}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-500 bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed. Please contact an admin for email updates.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
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
                  className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-8">
              <div className="flex items-center justify-between gap-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-800 truncate">Personal Information</h2>
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
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
                  <div className="font-semibold text-xl text-gray-800 truncate"
                  title={profile?.name}
                  >{profile?.name ?? "—"}</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 truncate"
                  title={profile?.email}
                  >Email</label>
                  <div className="text-gray-700">{profile?.email ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Change Password</h2>

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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
