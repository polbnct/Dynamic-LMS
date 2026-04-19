"use client";

import React, { useState } from "react";
import type { AnnouncementWithComments } from "@/lib/supabase/queries/announcements";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export interface CourseAnnouncementsSectionProps {
  mode: "professor" | "student";
  items: AnnouncementWithComments[];
  currentStudentId: string | null;
  onCreateAnnouncement: (title: string, body: string, files: File[]) => Promise<void>;
  onUpdateAnnouncement: (
    id: string,
    title: string,
    body: string,
    opts?: { newFiles?: File[] }
  ) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onAddComment: (announcementId: string, body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

export default function CourseAnnouncementsSection({
  mode,
  items,
  currentStudentId,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onDeleteAttachment,
  onAddComment,
  onDeleteComment,
}: CourseAnnouncementsSectionProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAllComments, setShowAllComments] = useState<Record<string, boolean>>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await onCreateAnnouncement(title.trim(), body.trim(), createFiles);
      setTitle("");
      setBody("");
      setCreateFiles([]);
    } finally {
      setCreating(false);
    }
  };

  const setDraft = (announcementId: string, value: string) => {
    setCommentDrafts((prev) => ({ ...prev, [announcementId]: value }));
  };

  const submitComment = async (announcementId: string) => {
    const text = (commentDrafts[announcementId] ?? "").trim();
    if (!text || busy) return;
    setBusy(`c-${announcementId}`);
    try {
      await onAddComment(announcementId, text);
      setDraft(announcementId, "");
    } finally {
      setBusy(null);
    }
  };

  const canDeleteComment = (studentId: string) => {
    if (mode === "professor") return true;
    return currentStudentId !== null && studentId === currentStudentId;
  };

  const startEditing = (id: string, currentTitle: string, currentBody: string) => {
    setEditingAnnouncementId(id);
    setEditTitle(currentTitle);
    setEditBody(currentBody);
    setEditNewFiles([]);
  };

  const cancelEditing = () => {
    setEditingAnnouncementId(null);
    setEditTitle("");
    setEditBody("");
    setEditNewFiles([]);
  };

  return (
    <div className="space-y-8">
      {mode === "professor" && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New announcement</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="announcement-title"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Title
              </label>
              <input
                id="announcement-title"
                maxLength={128}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent bg-gray-50/50 focus:bg-white"
                placeholder="e.g. Exam schedule update"
              />
            </div>
            <div>
              <label
                htmlFor="announcement-body"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Message
              </label>
              <textarea
                id="announcement-body"
                value={body}
                maxLength={2056}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent bg-gray-50/50 focus:bg-white resize-y min-h-[120px]"
                placeholder="Write your announcement for the class..."
              />
            </div>
            <div>
              <label
                htmlFor="announcement-files"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Attachments (optional)
              </label>
              <input
                id="announcement-files"
                type="file"
                multiple
                onChange={(e) => setCreateFiles(Array.from(e.target.files ?? []))}
                className="w-full border border-gray-300 p-2 rounded-xl text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
              />
              {createFiles.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {createFiles.length} file{createFiles.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
            <div className="flex">
            <button
              type="submit"
              disabled={creating || !title.trim() || !body.trim()}
              className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-3 mt-1 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {creating ? "Posting…" : "Post announcement"}
            </button>
            </div>
          </form>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-rose-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">
              {mode === "professor"
                ? "No announcements yet. Post one above to reach your students."
                : "No announcements yet. Check back later."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-6">
          {items.map(({ announcement: a, comments, attachments }) => (
            <li
              key={a.id}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-shadow duration-200"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold text-gray-900 break-words">{a.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {a.professor_name} · {formatWhen(a.created_at)}
                  </p>
                </div>
                {mode === "professor" && (
                  <div className="shrink-0 flex  flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(a.id, a.title, a.body)}
                      disabled={busy !== null}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white shadow-sm px-5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z"
                        />
                      </svg>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(a.id)}
                      disabled={busy === `del-a-${a.id}` || editingAnnouncementId === a.id}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white shadow-sm px-5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              {mode === "professor" && editingAnnouncementId === a.id ? (
                <form
                  className="space-y-3 mb-6"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(`edit-a-${a.id}`);
                    try {
                      await onUpdateAnnouncement(a.id, editTitle, editBody, {
                        newFiles: editNewFiles,
                      });
                      cancelEditing();
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent bg-gray-50/50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent bg-gray-50/50 focus:bg-white resize-y"
                    />
                  </div>
                  <div>
                    <p className="block text-sm font-medium text-gray-700 mb-2">Current files</p>
                    {attachments.length === 0 ? (
                      <p className="text-sm text-red-500 mb-5">No attachments.</p>
                    ) : (
                      <ul className="space-y-2 mb-3">
                        {attachments.map((att) => (
                          <li
                            key={att.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-gray-50/80 px-3 py-2"
                          >
                            <span className="text-sm text-gray-800 truncate">{att.file_name}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                setBusy(`rm-att-${att.id}`);
                                try {
                                  await onDeleteAttachment(att.id);
                                } finally {
                                  setBusy(null);
                                }
                              }}
                              disabled={busy === `rm-att-${att.id}`}
                              className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {busy === `rm-att-${att.id}` ? "…" : "Remove"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Add files
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setEditNewFiles(Array.from(e.target.files ?? []))}
                      className="w-full border border-gray-300 rounded-xl p-2 text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                    />
                  </div>
                  <div className="w-full flex justify-end gap-2 mt-4">
                    <button
                      type="submit"
                      disabled={busy === `edit-a-${a.id}` || !editTitle.trim() || !editBody.trim()}
                      className="w-1/2 sm:w-auto px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-100 transition"
                    >
                      {busy === `edit-a-${a.id}` ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={busy === `edit-a-${a.id}`}
                      className="w-1/2 sm:w-auto px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mb-4">
                    <p
                      className={`text-gray-800 whitespace-pre-wrap break-words ${
                        expanded[a.id] ? "" : "line-clamp-4"
                      }`}
                    >
                      {a.body}
                    </p>

                    {a.body.length > 150 && (
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [a.id]: !prev[a.id],
                          }))
                        }
                        className="text-sm text-red-600 hover:underline mt-1"
                      >
                        {expanded[a.id] ? "Show less" : "See more"}
                      </button>
                    )}
                  </div>
                  {attachments.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-2">Attachments</p>
                      <ul className="flex flex-col gap-2">
                        {attachments.map((att) => (
                          <li key={att.id}>
                            <a
                              href={att.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800 hover:underline"
                            >
                              <svg
                                className="h-4 w-4 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                />
                              </svg>
                              <span className="break-all">{att.file_name}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-4">Comments</h4>
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500 mb-4">No comments yet.</p>
                ) : (
                  (() => {
                    const visibleComments = showAllComments[a.id]
                      ? comments
                      : comments.slice(0, 4);

                    return (
                      <>
                        <ul className="space-y-3 mb-2">
                          {visibleComments.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{c.student_name}</p>
                          <p className="text-xs text-gray-500">{formatWhen(c.created_at)}</p>
                          <div className="mt-1">
                            <p
                              className={`text-gray-800 whitespace-pre-wrap break-words ${
                                expanded[c.id] ? "" : "line-clamp-4"
                              }`}
                            >
                              {c.body}
                            </p>

                            {c.body.length > 100 && (
                              <button
                                onClick={() =>
                                  setExpanded((prev) => ({
                                    ...prev,
                                    [c.id]: !prev[c.id],
                                  }))
                                }
                                className="text-xs text-red-600 hover:underline mt-1"
                              >
                                {expanded[c.id] ? "Show less" : "View more"}
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Comment removal intentionally hidden in UI */}
                      </li>
                    ))}
                  </ul>
                  {comments.length > 4 && (
                    <button
                      onClick={() =>
                        setShowAllComments((prev) => ({
                          ...prev,
                          [a.id]: !prev[a.id],
                        }))
                      }
                      className="text-sm text-gray-600 hover:text-red-600 mb-4"
                    >
                      {showAllComments[a.id]
                        ? "Show less comments"
                        : `View ${comments.length - 4} more comments`}
                    </button>
                  )}
                </>
              );})
            ())}
                {mode === "student" && (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={commentDrafts[a.id] ?? ""}
                      maxLength={1024}
                      onChange={(e) => setDraft(a.id, e.target.value)}
                      rows={3}
                      placeholder="Write a comment…"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => submitComment(a.id)}
                      disabled={
                        busy === `c-${a.id}` || !(commentDrafts[a.id] ?? "").trim()
                      }
                      className="w-full sm:w-auto self-end inline-flex justify-center bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-2 mt-2 rounded-xl text-sm font-semibold hover:from-red-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {busy === `c-${a.id}` ? "Posting…" : "Comment"}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Announcement
              </h3>

              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this announcement? This action cannot be undone.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="w-full sm:w-[20%] px-4 py-2 rounded-xl border border-gray-300 text-gray-900 hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    if (!confirmDeleteId) return;

                    setBusy(`del-a-${confirmDeleteId}`);
                    try {
                      await onDeleteAnnouncement(confirmDeleteId);
                      setConfirmDeleteId(null);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white border border-gray-300 hover:bg-red-100 text-gray-900 font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
