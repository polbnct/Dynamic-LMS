"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getQuizAttemptsGroupedByStudent,
  type StudentQuizStatus,
  type StudentWithAttempts,
} from "@/lib/supabase/queries/quiz-monitoring";

interface QuizMonitoringModalProps {
  quizId: string;
  quizName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuizMonitoringModal({
  quizId,
  quizName,
  isOpen,
  onClose,
}: QuizMonitoringModalProps) {
  const [studentGroups, setStudentGroups] = useState<StudentWithAttempts[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !quizId) return;

    fetchStudents();

    const supabase = createClient();
    const channel = supabase
      .channel(`quiz-activity-${quizId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_attempts",
          filter: `quiz_id=eq.${quizId}`,
        },
        () => fetchStudents()
      )
      .subscribe();

    const pollInterval = setInterval(fetchStudents, 3000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [isOpen, quizId]);

  const fetchStudents = async () => {
    try {
      const grouped = await getQuizAttemptsGroupedByStudent(quizId);
      setStudentGroups(grouped);
    } catch (error) {
      console.error("Error fetching quiz attempts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (attempt: StudentQuizStatus) => {
    if (attempt.submittedAt) return "bg-gray-100 text-gray-700";
    if (!attempt.isOnline) return "bg-red-100 text-red-700";
    if (!attempt.isFocused) return "bg-yellow-100 text-yellow-700";
    if (attempt.tabCount > 1) return "bg-orange-100 text-orange-700";
    return "bg-green-100 text-green-700";
  };

  const getStatusText = (attempt: StudentQuizStatus) => {
    if (attempt.submittedAt) return "Submitted";
    if (!attempt.isOnline) return "Disconnected";
    if (!attempt.isFocused) return "Tab Switched";
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15 5a9 9 0 00-9 9" />
        </svg>
      );
    }
    if (!attempt.isFocused || attempt.tabCount > 1) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Live Quiz Monitoring
            </h2>
            <p className="text-gray-600 text-sm mt-1">{quizName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{group.studentName}</h3>
                          <p className="text-sm text-gray-600">{group.studentEmail}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {group.attempts.length} attempt{group.attempts.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-gray-500">
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
                      <div className="border-t border-gray-200 bg-white/80 p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Attempts (logs)
                        </p>
                        <div className="space-y-2">
                          {group.attempts.map((attempt, idx) => (
                            <div
                              key={attempt.attemptId}
                              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-sm"
                            >
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
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                                  <span>Started: {formatDate(attempt.startedAt)}</span>
                                  {attempt.lastActivityAt && (
                                    <span>Last activity: {getTimeSince(attempt.lastActivityAt)}</span>
                                  )}
                                  {attempt.submittedAt && (
                                    <span className="text-gray-600">Submitted: {formatDate(attempt.submittedAt)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {studentGroups.length} student{studentGroups.length !== 1 ? "s" : ""} · {totalAttempts} total attempt
              {totalAttempts !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live updates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
