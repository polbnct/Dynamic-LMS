"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveQuizAttempts, type StudentQuizStatus } from "@/lib/supabase/queries/quiz-monitoring";

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
  const [students, setStudents] = useState<StudentQuizStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !quizId) return;

    // Initial fetch
    fetchStudents();

    // Set up Supabase Realtime subscription
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
        (payload) => {
          console.log("Quiz activity update:", payload);
          // Refetch students when activity changes
          fetchStudents();
        }
      )
      .subscribe();

    // Poll for updates every 3 seconds as backup
    const pollInterval = setInterval(fetchStudents, 3000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [isOpen, quizId]);

  const fetchStudents = async () => {
    try {
      const activeStudents = await getActiveQuizAttempts(quizId);
      setStudents(activeStudents);
    } catch (error) {
      console.error("Error fetching active students:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (student: StudentQuizStatus) => {
    if (student.submittedAt) {
      return "bg-gray-100 text-gray-700";
    }
    if (!student.isOnline) {
      return "bg-red-100 text-red-700";
    }
    if (!student.isFocused) {
      return "bg-yellow-100 text-yellow-700";
    }
    if (student.tabCount > 1) {
      return "bg-orange-100 text-orange-700";
    }
    return "bg-green-100 text-green-700";
  };

  const getStatusText = (student: StudentQuizStatus) => {
    if (student.submittedAt) {
      return "Submitted";
    }
    if (!student.isOnline) {
      return "Disconnected";
    }
    if (!student.isFocused) {
      return "Tab Switched";
    }
    if (student.tabCount > 1) {
      return `${student.tabCount} Tabs Open`;
    }
    return "Online";
  };

  const getStatusIcon = (student: StudentQuizStatus) => {
    if (student.submittedAt) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (!student.isOnline) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15 5a9 9 0 00-9 9" />
        </svg>
      );
    }
    if (!student.isFocused || student.tabCount > 1) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  const getTimeSince = (dateString: string | null) => {
    if (!dateString) return "Just now";
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Live Quiz Monitoring
            </h2>
            <p className="text-gray-600 text-sm mt-1">{quizName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No active quiz attempts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.attemptId}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-lg ${getStatusColor(student)}`}>
                        {getStatusIcon(student)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{student.studentName}</h3>
                        <p className="text-sm text-gray-600">{student.studentEmail}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span>Started: {formatTime(student.startedAt)}</span>
                          {student.lastActivityAt && (
                            <span>Last activity: {getTimeSince(student.lastActivityAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(student)}`}>
                        {getStatusText(student)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{students.length} active attempt{students.length !== 1 ? "s" : ""}</span>
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
