"use client";

import React, { useEffect, useState } from "react";
import {
  getQuizAttemptsGroupedByStudent,
  getActivityLogsForAttempts,
  type StudentQuizStatus,
  type StudentWithAttempts,
  type QuizActivityLogEntry,
} from "@/lib/supabase/queries/quiz-monitoring";
import { getQuizAttemptWithAnswers, type QuizResultWithAnswers } from "@/lib/supabase/queries/quizzes";

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
  const [activityLogsByAttemptId, setActivityLogsByAttemptId] = useState<Record<string, QuizActivityLogEntry[]>>({});
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsAttemptLabel, setResultsAttemptLabel] = useState<string>("");
  const [resultsData, setResultsData] = useState<QuizResultWithAnswers | null>(null);

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

  const formatMcAnswer = (
    value: unknown,
    options?: string[]
  ): string => {
    if (!options || options.length === 0) return String(value ?? "");
    const idx =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
          ? Number(value)
          : null;
    if (idx == null || !Number.isFinite(idx)) return String(value ?? "");
    const letter = String.fromCharCode(65 + idx);
    const opt = options[idx];
    return opt != null ? `${letter}. ${opt}` : `${letter}.`;
  };

  const formatAnswer = (a: QuizResultWithAnswers["answers"][number]) => {
    if (a.questionType === "multiple_choice") {
      return {
        user: formatMcAnswer(a.userAnswer, a.options),
        correct: formatMcAnswer(a.correctAnswer, a.options),
      };
    }
    if (a.questionType === "true_false") {
      return {
        user: typeof a.userAnswer === "boolean" ? (a.userAnswer ? "True" : "False") : String(a.userAnswer ?? ""),
        correct: typeof a.correctAnswer === "boolean" ? (a.correctAnswer ? "True" : "False") : String(a.correctAnswer ?? ""),
      };
    }
    return {
      user: String(a.userAnswer ?? ""),
      correct: String(a.correctAnswer ?? ""),
    };
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

  const totalAttempts = studentGroups.reduce((sum, g) => sum + g.attempts.length, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start sm:items-center justify-between gap-3 p-4 sm:p-6 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
              Quiz attempts & activity logs
            </h2>
            <p className="text-gray-600 text-sm mt-1 break-words">{quizName}</p>
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
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setResultsModalOpen(true);
                                          setResultsLoading(true);
                                          setResultsData(null);
                                          setResultsAttemptLabel(`${group.studentName} · Attempt #${group.attempts.length - idx}`);
                                          try {
                                            const data = await getQuizAttemptWithAnswers(attempt.attemptId);
                                            setResultsData(data);
                                          } finally {
                                            setResultsLoading(false);
                                          }
                                        }}
                                        className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                                      >
                                        View score & answers
                                      </button>
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

      {/* Results modal (score + answers) */}
      {resultsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-start sm:items-center justify-between gap-3 p-4 sm:p-6 border-b border-gray-200">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-800">Quiz results</h3>
                <p className="text-sm text-gray-600 mt-0.5 break-words">{resultsAttemptLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResultsModalOpen(false);
                  setResultsData(null);
                }}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {resultsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent" />
                </div>
              ) : !resultsData ? (
                <p className="text-gray-600">No results found for this attempt.</p>
              ) : (
                <div className="space-y-5">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">Score:</span>{" "}
                      {resultsData.attempt.score ?? 0}/{resultsData.attempt.max_score ?? 0}
                    </div>
                    <div className="text-sm font-semibold text-red-700">
                      {resultsData.attempt.max_score
                        ? `${Math.round(((resultsData.attempt.score ?? 0) / resultsData.attempt.max_score) * 100)}%`
                        : ""}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Answers</h4>
                    {resultsData.answers.length === 0 ? (
                      <p className="text-gray-600 text-sm">No answers recorded.</p>
                    ) : (
                      <div className="space-y-3">
                        {resultsData.answers.map((a, i) => {
                          const formatted = formatAnswer(a);
                          return (
                            <div
                            key={`${a.questionId}-${i}`}
                            className={`rounded-xl border p-4 ${
                              a.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800">
                                  {i + 1}. {a.questionText}
                                </p>
                                <p className="text-xs text-gray-600 mt-1 capitalize">Type: {a.questionType.replace("_", " ")}</p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  a.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}
                              >
                                {a.isCorrect ? "Correct" : "Wrong"}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Student answer</p>
                                <p className="text-gray-800 mt-1 break-words">{formatted.user}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Correct answer</p>
                                <p className="text-gray-800 mt-1 break-words">{formatted.correct}</p>
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
