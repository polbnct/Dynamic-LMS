"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  getQuizAttemptsGroupedByStudent,
  getActivityLogsForAttempts,
  type StudentQuizStatus,
  type StudentWithAttempts,
  type QuizActivityLogEntry,
} from "@/lib/supabase/queries/quiz-monitoring";

interface QuizMonitoringModalProps {
  courseId: string;
  quizId: string;
  quizName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuizMonitoringModal({
  courseId,
  quizId,
  quizName,
  isOpen,
  onClose,
}: QuizMonitoringModalProps) {
  const [studentGroups, setStudentGroups] = useState<StudentWithAttempts[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [activityLogsByAttemptId, setActivityLogsByAttemptId] = useState<Record<string, QuizActivityLogEntry[]>>({});
  useEffect(() => {
    if (!isOpen || !quizId) return;
    // Fetch a snapshot of attempts and activity logs when the modal opens.
    fetchStudents();
  }, [isOpen, quizId]);

  const fetchStudents = async () => {
    try {
      const grouped = await getQuizAttemptsGroupedByStudent(quizId);
      setStudentGroups(grouped);
      const attemptIds = grouped.flatMap((g) => g.attempts.map((a) => a.attemptId));
      const logs = await getActivityLogsForAttempts(attemptIds);
      setActivityLogsByAttemptId(logs);
    } catch (error) {
      console.error("Error fetching quiz attempts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (attempt: StudentQuizStatus) => {
    if (attempt.submittedAt) return "bg-gray-100 text-gray-700";
    if (!attempt.isOnline) return "bg-gray-100 text-gray-500";
    if (!attempt.isFocused) return "bg-yellow-100 text-yellow-700";
    if (attempt.tabCount > 1) return "bg-orange-100 text-orange-700";
    return "bg-green-100 text-green-700";
  };

  const getStatusText = (attempt: StudentQuizStatus) => {
    if (attempt.submittedAt) return "Submitted";
    if (!attempt.isOnline) return "Offline";
    // Only show "Disconnected" when student is not focused (alt-tab / switched tab).
    if (!attempt.isFocused) return "Disconnected";
    if (attempt.tabCount > 1) return `${attempt.tabCount} Tabs Open`;
    return "Online";
  };

  const getStatusIcon = (attempt: StudentQuizStatus) => {
    if (attempt.submittedAt) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (!attempt.isOnline) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728"
          />
        </svg>
      );
    }
    if (!attempt.isFocused || attempt.tabCount > 1) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString();
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  const getTimeSince = (dateString: string | null) => {
    if (!dateString) return "Just now";
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const totalAttempts = studentGroups.reduce((sum, g) => sum + g.attempts.length, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start sm:items-center justify-between gap-3 p-4 sm:p-6 border-b border-gray-200">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
              Quiz attempts & activity logs
            </h2>
            <p className="text-gray-600 text-sm mt-1 truncate" title={quizName}
             > {quizName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : studentGroups.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No quiz attempts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {studentGroups.map((group) => {
                const isExpanded = expandedStudentId === group.studentId;
                return (
                  <div
                    key={group.studentId}
                    className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedStudentId(isExpanded ? null : group.studentId)}
                    className="w-full flex items-start sm:items-center justify-between gap-3 p-4 text-left hover:bg-gray-100/80 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-red-100 text-red-700">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-800 break-words">{group.studentName}</h3>
                          <p className="text-sm text-gray-600 break-all">{group.studentEmail}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {group.attempts.length} attempt{group.attempts.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    <span className="text-gray-500 shrink-0">
                        {isExpanded ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-white/80 p-3 sm:p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Attempts & activity logs
                        </p>
                        <div className="space-y-4">
                          {group.attempts.map((attempt, idx) => {
                            const logs = activityLogsByAttemptId[attempt.attemptId] || [];
                            return (
                              <div key={attempt.attemptId} className="rounded-lg border border-gray-200 bg-gray-50/80 overflow-hidden">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 text-sm">
                                  <div className={`p-1.5 rounded-md ${getStatusColor(attempt)}`}>
                                    {getStatusIcon(attempt)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium text-gray-800">
                                        Attempt #{group.attempts.length - idx}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(attempt)}`}>
                                        {getStatusText(attempt)}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                                      <span>Started: {formatDate(attempt.startedAt)}</span>
                                      {attempt.lastActivityAt && (
                                        <span>Last activity: {getTimeSince(attempt.lastActivityAt)}</span>
                                      )}
                                      {attempt.submittedAt && (
                                        <span className="text-gray-600">Submitted: {formatDate(attempt.submittedAt)}</span>
                                      )}
                                    </div>
                                  </div>
                                  {attempt.submittedAt && (
                                    <div className="shrink-0 sm:ml-auto">
                                      <Link
                                        href={`/prof/courses/${courseId}/quizzes/${quizId}/attempts/${attempt.attemptId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex w-full sm:w-auto items-center justify-center px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                                      >
                                        View score
                                      </Link>
                                    </div>
                                  )}
                                </div>
                                {logs.length > 0 && (
                                  <div className="border-t border-gray-100 px-3 py-2 bg-white/60">
                                    <p className="text-xs font-medium text-gray-500 mb-2">Activity log (tab switch, focus, etc.)</p>
                                    <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                      {logs.map((log) => (
                                        <li key={log.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-gray-600">
                                          <span className="capitalize break-words">
                                            {log.event_type === "blurred"
                                              ? "tab switched"
                                              : log.event_type === "focused"
                                                ? "returned to quiz"
                                                : log.event_type === "tab_count"
                                                  ? "tab count changed"
                                                  : log.event_type}
                                          </span>
                                          {log.tab_count != null && log.tab_count > 1 && (
                                            <span className="text-orange-600">{log.tab_count} tabs</span>
                                          )}
                                          <span className="text-gray-400">{formatDate(log.created_at)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50 text-xs sm:text-sm text-gray-600">
          {studentGroups.length} student{studentGroups.length !== 1 ? "s" : ""} · {totalAttempts} total attempt
          {totalAttempts !== 1 ? "s" : ""}
        </div>
      </div>

    </div>
  );
}
