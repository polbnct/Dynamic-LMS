"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";
import { getCourseById } from "@/lib/supabase/queries/courses.client";
import { getLessons, type Lesson } from "@/lib/supabase/queries/lessons";
import {
  addLessonStudyQuestions,
  getLessonStudyQuestions,
  removeLessonStudyQuestion,
  updateLessonStudyQuestion,
  type StudyAidQuestion,
} from "@/lib/supabase/queries/study-aid";
import { buildQuestionSignature } from "@/lib/questions/signature";

function getValidatedStudyAidCount(
  type: "summary" | "flashcard" | "multiple_choice" | "fill_blank",
  count: number
) {
  if (type === "summary") return 1;
  const safeCount = Number(count);
  if (!Number.isFinite(safeCount)) return 10;
  return Math.min(10, Math.max(1, safeCount));
}

function EditStudyQuestionForm({
  question,
  onSave,
  onCancel,
  saving,
}: {
  question: StudyAidQuestion;
  onSave: (updates: {
    type?: "multiple_choice" | "true_false" | "fill_blank" | "summary";
    question?: string;
    options?: string[];
    fill_blank_answer_mode?: "symbol_only" | "term_only" | null;
    correct_answer?:
      | number
      | boolean
      | string
      | {
          answer: number | boolean | string;
          correct_explanation?: string;
          incorrect_explanation?: string;
        };
  }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const normalizedCorrectAnswer =
    question.correct_answer && typeof question.correct_answer === "object" && "answer" in question.correct_answer
      ? question.correct_answer.answer
      : question.correct_answer;
  const [questionText, setQuestionText] = useState(question.question);
  const [type, setType] = useState<"multiple_choice" | "true_false" | "fill_blank" | "summary">(question.type);
  const [options, setOptions] = useState<string[]>(
    question.type === "multiple_choice" && question.options?.length ? question.options : ["", "", "", ""]
  );
  const [correctAnswerMc, setCorrectAnswerMc] = useState(
    question.type === "multiple_choice" ? Number(normalizedCorrectAnswer) : 0
  );
  const [correctAnswerFlashcard, setCorrectAnswerFlashcard] = useState(
    question.type === "true_false" ? String(normalizedCorrectAnswer ?? "") : ""
  );
  const [correctAnswerFill, setCorrectAnswerFill] = useState(
    question.type === "fill_blank" || question.type === "summary" ? String(normalizedCorrectAnswer ?? "") : ""
  );
  const [fillBlankAnswerMode, setFillBlankAnswerMode] = useState<"symbol_only" | "term_only">(
    question.type === "fill_blank" ? (question.fill_blank_answer_mode ?? "term_only") : "term_only"
  );
  const [correctFeedback, setCorrectFeedback] = useState(
    question.correct_answer &&
      typeof question.correct_answer === "object" &&
      "correct_explanation" in question.correct_answer
      ? String(question.correct_answer.correct_explanation || "")
      : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const existingAnswerMeta =
      question.correct_answer && typeof question.correct_answer === "object" && "answer" in question.correct_answer
        ? question.correct_answer
        : null;
    const withExistingExplanation = (answer: number | boolean | string) => ({
      answer,
      correct_explanation: correctFeedback.trim(),
      incorrect_explanation: existingAnswerMeta?.incorrect_explanation,
    });
    if (type === "multiple_choice") {
      const opts = options.map((o) => o.trim() || "");
      await onSave({
        question: questionText.trim(),
        type,
        options: opts.some((o) => o) ? opts : ["Option A", "Option B", "Option C", "Option D"],
        correct_answer: withExistingExplanation(correctAnswerMc),
      });
    } else if (type === "true_false") {
      await onSave({
        question: questionText.trim(),
        type,
        correct_answer: withExistingExplanation(correctAnswerFlashcard.trim() || "Review the lesson key idea for this card."),
      });
    } else {
      await onSave({
        question: questionText.trim(),
        type,
        fill_blank_answer_mode: type === "fill_blank" ? fillBlankAnswerMode : null,
        correct_answer: withExistingExplanation(correctAnswerFill.trim() || " "),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 min-h-[150px] sm:min-h-[120px]"
        required
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as any)}
        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-white"
      >
        <option value="multiple_choice">Multiple choice</option>
        <option value="true_false">Flashcard</option>
        <option value="fill_blank">Fill in the blank</option>
        <option value="summary">Summary</option>
      </select>
      {type === "multiple_choice" && (
      <>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-6 shrink-0 font-semibold text-gray-700">
              {String.fromCharCode(65 + i)}.
            </span>
            <input
              value={opt}
              onChange={(e) =>
                setOptions((prev) => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })
              }
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-500 focus:outline-none"
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
            />
          </div>
        ))}
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Answer</p>
          <select
            value={correctAnswerMc}
            onChange={(e) => setCorrectAnswerMc(parseInt(e.target.value, 10))}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:outline-none"
          >
            {options.map((opt, i) => (
              <option key={i} value={i}>
                {String.fromCharCode(65 + i)}. {opt || "(empty)"}
              </option>
            ))}
          </select>
        </div>
        </>
      )}
            {type === "true_false" && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Answer</p>
          <textarea
            value={correctAnswerFlashcard}
            onChange={(e) => setCorrectAnswerFlashcard(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
            placeholder="Enter the explanation shown on the back of the flashcard"
          />
        </div>
      )}
            {type === "fill_blank" && (
        <>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Correct Answer</p>
            <input
              value={correctAnswerFill}
              onChange={(e) => setCorrectAnswerFill(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900"
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Answer Mode Tag</p>
            <select
              value={fillBlankAnswerMode}
              onChange={(e) => setFillBlankAnswerMode(e.target.value as "symbol_only" | "term_only")}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-white"
            >
              <option value="term_only">Term only</option>
              <option value="symbol_only">Symbol only</option>
            </select>
          </div>
        </>
      )}
      <div>
          {type !== "summary" && (
          <>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Feedback</p>
            <textarea
              value={correctFeedback}
              onChange={(e) => setCorrectFeedback(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 min-h-[120px] sm:min-h-[100px]"
              placeholder="Brief feedback for correct answer"
            />
          </>
        )}
      </div>
      <div className="flex flex-row gap-2 sm:justify-end">
        <button type="button" onClick={onCancel} className="flex-1 sm:flex-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-slate-100 cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 sm:flex-none rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-200 cursor-pointer">
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export default function ProfessorLessonStudyAidPage() {
  const params = useParams();
  const courseId = params.id as string;
  const lessonId = params.lessonId as string;

  const [course, setCourse] = useState<any>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [studyAidQuestions, setStudyAidQuestions] = useState<StudyAidQuestion[]>([]);
  type DraftQuestion = {
    type: "multiple_choice" | "true_false" | "fill_blank" | "summary";
    question: string;
    options?: string[];
    correct_answer:
      | number
      | boolean
      | string
      | {
          answer: number | boolean | string;
          correct_explanation?: string;
          incorrect_explanation?: string;
        };
    fill_blank_answer_mode?: "symbol_only" | "term_only" | null;
  };
  const [generatedForStudy, setGeneratedForStudy] = useState<DraftQuestion[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<number>>(new Set());
  const [studyAidGenerateType, setStudyAidGenerateType] = useState<"summary" | "flashcard" | "multiple_choice" | "fill_blank">("multiple_choice");
  const [studyAidGenerateCount, setStudyAidGenerateCount] = useState(1);
  const [studyAidLoading, setStudyAidLoading] = useState(false);
  const [studyAidGenerating, setStudyAidGenerating] = useState(false);
  const [studyAidAdding, setStudyAidAdding] = useState(false);
  const [editingStudyQuestion, setEditingStudyQuestion] = useState<StudyAidQuestion | null>(null);
  const [studyAidSaving, setStudyAidSaving] = useState(false);
  const [studyAidViewType, setStudyAidViewType] = useState<"summary" | "true_false" | "fill_blank" | "multiple_choice">("summary");
  const [studyAidSearch, setStudyAidSearch] = useState("");
  const [selectedStudyAidIds, setSelectedStudyAidIds] = useState<Set<string>>(new Set());
  const [deletingSelectedStudyAids, setDeletingSelectedStudyAids] = useState(false);
  const [editingDraftIndex, setEditingDraftIndex] = useState<number | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);

  useSyncMessagesToToast(error, success);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [courseData, lessonsData] = await Promise.all([getCourseById(courseId), getLessons(courseId)]);
        setCourse(courseData);
        const found = lessonsData.find((l) => l.id === lessonId) ?? null;
        setLesson(found);
        if (found) {
          setStudyAidLoading(true);
          const list = await getLessonStudyQuestions(found.id);
          setStudyAidQuestions(list);
          setStudyAidLoading(false);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, lessonId]);

  useEffect(() => {
    setSelectedStudyAidIds((prev) => {
      const valid = new Set(studyAidQuestions.map((q) => q.id));
      return new Set(Array.from(prev).filter((id) => valid.has(id)));
    });
  }, [studyAidQuestions]);

  const orderedStudyAidQuestions = useMemo(() => {
    const typePriority: Record<StudyAidQuestion["type"], number> = {
      summary: 0,
      true_false: 1,
      fill_blank: 2,
      multiple_choice: 3,
    };
    return [...studyAidQuestions].sort((a, b) => {
      const byType = typePriority[a.type] - typePriority[b.type];
      if (byType !== 0) return byType;
      const byQuestion = a.question.localeCompare(b.question, undefined, { sensitivity: "base" });
      if (byQuestion !== 0) return byQuestion;
      return a.id.localeCompare(b.id);
    });
  }, [studyAidQuestions]);

  const studyAidCounts = useMemo(
    () => ({
      summary: orderedStudyAidQuestions.filter((q) => q.type === "summary").length,
      true_false: orderedStudyAidQuestions.filter((q) => q.type === "true_false").length,
      fill_blank: orderedStudyAidQuestions.filter((q) => q.type === "fill_blank").length,
      multiple_choice: orderedStudyAidQuestions.filter((q) => q.type === "multiple_choice").length,
    }),
    [orderedStudyAidQuestions]
  );
  const filteredStudyAidQuestions = useMemo(() => {
    const q = studyAidSearch.trim().toLowerCase();
    return orderedStudyAidQuestions.filter((item) => item.type === studyAidViewType && (!q || item.question.toLowerCase().includes(q)));
  }, [orderedStudyAidQuestions, studyAidViewType, studyAidSearch]);
  const hasExistingSummary = useMemo(() => studyAidQuestions.some((q) => q.type === "summary"), [studyAidQuestions]);
  const editingDraftQuestion = useMemo(() => {
    if (editingDraftIndex === null) return null;
    const draft = generatedForStudy[editingDraftIndex];
    if (!draft) return null;
    return {
      id: `draft-${editingDraftIndex}`,
      type: draft.type,
      question: draft.question,
      options: draft.options,
      correct_answer: draft.correct_answer,
      fill_blank_answer_mode: draft.fill_blank_answer_mode ?? "term_only",
    } satisfies StudyAidQuestion;
  }, [editingDraftIndex, generatedForStudy]);

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50" />;
  }

  const handleSaveAndExit = () => {
    window.close();
    setTimeout(() => {
      if (typeof window !== "undefined" && !window.closed) {
        window.history.back();
      }
    }, 150);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {course?.name} ({course?.code})
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{lesson?.title ?? "Lesson"} - Study Aids</h1>
            </div>
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 cursor-pointer"
            >
              Save & Exit
            </button>
          </div>
        </div>

        {!lesson?.pdf_file_path ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Upload a PDF to this lesson first, then you can manage Study Aid here.
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-gray-200 bg-white">
                <h3 className="font-semibold text-gray-800">Study Aid Questions</h3>
              </div>
              <div className="p-4 sm:p-5">
                {studyAidLoading ? (
                  <div className="py-8 text-center text-gray-500">Loading...</div>
                ) : studyAidQuestions.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">No questions yet.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full">
                        {[
                          { key: "summary", label: "Summary", count: studyAidCounts.summary },
                          { key: "true_false", label: "Flashcards", count: studyAidCounts.true_false },
                          { key: "fill_blank", label: "Fill in the Blank", count: studyAidCounts.fill_blank },
                          { key: "multiple_choice", label: "Multiple Choice", count: studyAidCounts.multiple_choice },
                        ].map((tab) => (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => {
                              setStudyAidViewType(tab.key as any);
                              setSelectedStudyAidIds(new Set());
                            }}
                            className={`px-3 py-2 rounded-full text-xs font-semibold border cursor-pointer ${
                              studyAidViewType === tab.key
                                ? "bg-red-600 text-white border-red-600"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-slate-100"
                            }`}
                          >
                            {tab.label} ({tab.count})
                          </button>
                        ))}
                      </div>
                      <div className="lg:ml-auto w-full lg:w-72">
                        <input
                          type="text"
                          value={studyAidSearch}
                          onChange={(e) => {
                            setStudyAidSearch(e.target.value);
                          }}
                          placeholder="Search questions..."
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {filteredStudyAidQuestions.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={filteredStudyAidQuestions.length > 0 && filteredStudyAidQuestions.every((q) => selectedStudyAidIds.has(q.id))}
                            onChange={(e) => {
                              setSelectedStudyAidIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) filteredStudyAidQuestions.forEach((q) => next.add(q.id));
                                else filteredStudyAidQuestions.forEach((q) => next.delete(q.id));
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer"
                          />
                          Select All
                        </label>
                        <button
                          type="button"
                          disabled={selectedStudyAidIds.size === 0 || deletingSelectedStudyAids}
                          onClick={async () => {
                            if (selectedStudyAidIds.size === 0 || !lesson) return;
                            if (!window.confirm(`Delete ${selectedStudyAidIds.size} selected study aid(s)?`)) return;
                            try {
                              setDeletingSelectedStudyAids(true);
                              const ids = Array.from(selectedStudyAidIds);
                              await Promise.all(ids.map((id) => removeLessonStudyQuestion(lesson.id, id)));
                              setStudyAidQuestions((prev) => prev.filter((q) => !selectedStudyAidIds.has(q.id)));
                              setSelectedStudyAidIds(new Set());
                              setSuccess(`${ids.length} study aid${ids.length !== 1 ? "s" : ""} deleted.`);
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setDeletingSelectedStudyAids(false);
                            }
                          }}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:bg-red-700 transition-all duration-200"
                        >
                          {deletingSelectedStudyAids ? "Deleting..." : `Delete Selected${selectedStudyAidIds.size > 0 ? ` (${selectedStudyAidIds.size})` : ""}`}
                        </button>
                      </div>
                    )}

                    {filteredStudyAidQuestions.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-white py-8 text-center text-sm text-gray-500">
                        No questions match your filter.
                      </div>
                    ) : (
                      <>
                        <ul className="max-h-[56vh] space-y-2 overflow-y-auto pr-1">
                          {filteredStudyAidQuestions.map((q) => (
                            <li key={q.id} className="rounded-xl border border-gray-200 bg-white p-3 overflow-hidden">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedStudyAidIds.has(q.id)}
                                    onChange={(e) =>
                                      setSelectedStudyAidIds((prev) => {
                                        const next = new Set(prev);
                                        if (e.target.checked) next.add(q.id);
                                        else next.delete(q.id);
                                        return next;
                                      })
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer"
                                  />
                                  <span className="inline-flex shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                    {q.type === "true_false" ? "Flashcard" : q.type === "fill_blank" ? "Fill in the Blank" : q.type === "multiple_choice" ? "Multiple Choice" : "Summary"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setEditingStudyQuestion(q)}
                                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-slate-100 cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!lesson) return;
                                      if (!window.confirm("Delete this study aid?")) return;
                                      try {
                                        await removeLessonStudyQuestion(lesson.id, q.id);
                                        setStudyAidQuestions((prev) => prev.filter((x) => x.id !== q.id));
                                        setSuccess("Study aid deleted.");
                                      } catch (e) {
                                        setError((e as Error).message);
                                      }
                                    }}
                                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-slate-100 cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                              <span className="text-sm text-gray-800 break-words">{q.question}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="text-xs text-gray-500">
                          Showing {filteredStudyAidQuestions.length} result{filteredStudyAidQuestions.length !== 1 ? "s" : ""}
                        </div>
                      </>
                    )}

                    {editingStudyQuestion && lesson && (
                      <div className="mt-5 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                        <h4 className="mb-4 font-semibold text-gray-800">Edit question</h4>
                        <EditStudyQuestionForm
                          key={editingStudyQuestion.id}
                          question={editingStudyQuestion}
                          onSave={async (updates) => {
                            setStudyAidSaving(true);
                            setError("");
                            try {
                              const updated = await updateLessonStudyQuestion(lesson.id, editingStudyQuestion.id, updates);
                              setStudyAidQuestions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                              setEditingStudyQuestion(null);
                              setSuccess("Study aid updated.");
                              setTimeout(() => setSuccess(""), 3000);
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setStudyAidSaving(false);
                            }
                          }}
                          onCancel={() => setEditingStudyQuestion(null)}
                          saving={studyAidSaving}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-gray-200 bg-white">
                <h3 className="font-semibold text-gray-800">Generate with AI (Gemini)</h3>
              </div>
              <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">Question type</label>
                    <select
                      value={studyAidGenerateType}
                      onChange={(e) => {
                        setStudyAidGenerateType(e.target.value as any);
                        if (e.target.value === "summary") setStudyAidGenerateCount(1);
                      }}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 cursor-pointer"
                    >
                      <option value="summary">Summary (1 per lesson)</option>
                      <option value="flashcard">Flashcard</option>
                      <option value="multiple_choice">Multiple choice</option>
                      <option value="fill_blank">Fill in the blank</option>
                    </select>
                  </div>
                  {studyAidGenerateType !== "summary" && (
                    <div className="w-full sm:w-24">
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">Count</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={studyAidGenerateCount === 0 ? "" : studyAidGenerateCount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            setStudyAidGenerateCount(0);
                            return;
                          }
                          const raw = Number(value);
                          if (Number.isFinite(raw) && raw > 0) setStudyAidGenerateCount(Math.min(10, raw));
                        }}
                        onBlur={() => {
                          if (studyAidGenerateCount === 0 || studyAidGenerateCount < 1) setStudyAidGenerateCount(1);
                        }}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={studyAidGenerating || !lesson || (studyAidGenerateType === "summary" && hasExistingSummary)}
                    onClick={async () => {
                      if (!lesson) return;
                      if (studyAidGenerateType === "summary" && hasExistingSummary) return;
                      setStudyAidGenerating(true);
                      setError("");
                      try {
                        const res = await fetch("/api/gemini/generate-questions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            lessonId: lesson.id,
                            questionType:
                              studyAidGenerateType === "summary" || studyAidGenerateType === "fill_blank"
                                ? "fill_blank"
                                : studyAidGenerateType === "flashcard"
                                  ? "true_false"
                                  : "multiple_choice",
                            count: getValidatedStudyAidCount(studyAidGenerateType, studyAidGenerateCount),
                            forStudyAid: true,
                            studyAidSummary: studyAidGenerateType === "summary",
                            studyAidFlashcard: studyAidGenerateType === "flashcard",
                          }),
                        });
                        if (!res.ok) throw new Error((await res.json()).error || "Generate failed");
                        const data = await res.json();
                        const generated = Array.isArray(data.questions) ? data.questions : [];
                        const deduped: DraftQuestion[] = [];
                        const seen = new Set<string>();
                        for (const q of generated) {
                          const signature = buildQuestionSignature({
                            type: q.type,
                            question: q.question,
                            options: q.options,
                            correctAnswer: q.correct_answer,
                          });
                          if (seen.has(signature)) continue;
                          seen.add(signature);
                          deduped.push(q);
                        }
                        setGeneratedForStudy(deduped);
                        setSelectedGenerated(new Set(deduped.map((_: any, i: number) => i)));
                        setSuccess(`${deduped.length} study aid${deduped.length !== 1 ? "s" : ""} generated.`);
                      } catch (e) {
                        setError((e as Error).message);
                        setGeneratedForStudy([]);
                      } finally {
                        setStudyAidGenerating(false);
                      }
                    }}
                    className="rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-rose-700 hover:to-red-700 cursor-pointer sm:col-start-2">
                    {studyAidGenerating ? "Generating..." : "Generate"}
                  </button>
                  {studyAidGenerateType === "summary" && hasExistingSummary && (
                    <p className="sm:col-span-2 text-center text-sm font-medium text-amber-700">
                      Only one summary is allowed per lesson. Remove the existing summary first to generate another.
                    </p>
                  )}
                </div>

                {generatedForStudy.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                      {generatedForStudy.map((q: any, idx: number) => (
                        <li
                          key={idx}
                          className={`flex cursor-pointer items-start gap-3 px-4 py-3 ${selectedGenerated.has(idx) ? "bg-red-50/80" : "hover:bg-gray-50"}`}
                          onClick={() =>
                            setSelectedGenerated((prev) => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              return next;
                            })
                          }
                        >
                          <input type="checkbox" checked={selectedGenerated.has(idx)} onChange={() => {}} />
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                              {q.type === "true_false"
                                ? "Flashcard"
                                : q.type === "fill_blank"
                                  ? "Fill in the Blank"
                                  : q.type === "multiple_choice"
                                    ? "Multiple Choice"
                                    : "Summary"}
                            </span>
                            <span className="mt-1 block break-words text-sm text-gray-800">{q.question}</span>
                          </div>
                          <div className="ml-auto flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingDraftIndex(idx);
                              }}
                              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGeneratedForStudy((prev) => prev.filter((_, i) => i !== idx));
                                setSelectedGenerated((prev) => {
                                  const next = new Set<number>();
                                  prev.forEach((value) => {
                                    if (value === idx) return;
                                    next.add(value > idx ? value - 1 : value);
                                  });
                                  return next;
                                });
                                if (editingDraftIndex !== null && editingDraftIndex === idx) {
                                  setEditingDraftIndex(null);
                                } else if (editingDraftIndex !== null && editingDraftIndex > idx) {
                                  setEditingDraftIndex((cur) => (cur === null ? cur : cur - 1));
                                }
                              }}
                              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setGeneratedForStudy([]);
                            setSelectedGenerated(new Set());
                            setEditingDraftIndex(null);
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          Clear drafts
                        </button>
                        <button
                          type="button"
                          disabled={studyAidAdding || selectedGenerated.size === 0 || !lesson || (studyAidGenerateType === "summary" && hasExistingSummary)}
                          onClick={async () => {
                            if (!lesson) return;
                            if (studyAidGenerateType === "summary" && hasExistingSummary) return;
                            const toAdd = generatedForStudy.filter((_, i: number) => selectedGenerated.has(i));
                            if (!toAdd.length) return;
                            setStudyAidAdding(true);
                            try {
                              const payload = toAdd.map((q) => ({
                                type: studyAidGenerateType === "summary" ? "summary" : q.type,
                                question: q.question,
                                options: q.options,
                                fill_blank_answer_mode: q.fill_blank_answer_mode ?? "term_only",
                                correct_answer: q.correct_answer,
                              }));
                              const result = await addLessonStudyQuestions(lesson.id, payload as any);
                              const list = await getLessonStudyQuestions(lesson.id);
                              setStudyAidQuestions(list);
                              setGeneratedForStudy([]);
                              setSelectedGenerated(new Set());
                              setSelectedStudyAidIds(new Set());
                              setEditingDraftIndex(null);
                              const duplicateNote =
                                result.skippedDuplicates > 0
                                  ? ` (${result.skippedDuplicates} duplicate${result.skippedDuplicates !== 1 ? "s" : ""} skipped)`
                                  : "";
                              setSuccess(`${result.added} study aid${result.added !== 1 ? "s" : ""} added${duplicateNote}.`);
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setStudyAidAdding(false);
                            }
                          }}
                          className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                        >
                          {studyAidAdding ? "Adding..." : `Add ${selectedGenerated.size} to study aid`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {editingDraftQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-5">
            <h3 className="mb-4 text-lg font-bold text-gray-900">Edit Generated Draft</h3>
            <EditStudyQuestionForm
              question={editingDraftQuestion}
              onSave={async (updates) => {
                if (editingDraftIndex === null) return;
                setDraftSaving(true);
                try {
                  setGeneratedForStudy((prev) =>
                    prev.map((draft, idx) => {
                      if (idx !== editingDraftIndex) return draft;
                      const nextType = (updates.type ?? draft.type) as DraftQuestion["type"];
                      const nextCorrect =
                        updates.correct_answer !== undefined ? updates.correct_answer : draft.correct_answer;
                      return {
                        ...draft,
                        type: nextType,
                        question: updates.question ?? draft.question,
                        options:
                          updates.options !== undefined
                            ? updates.options
                            : nextType === "multiple_choice"
                              ? draft.options
                              : undefined,
                        correct_answer: nextCorrect,
                        fill_blank_answer_mode:
                          nextType === "fill_blank"
                            ? (updates.fill_blank_answer_mode ?? draft.fill_blank_answer_mode ?? "term_only")
                            : null,
                      };
                    })
                  );
                  setEditingDraftIndex(null);
                  setSuccess("Draft updated.");
                } finally {
                  setDraftSaving(false);
                }
              }}
              onCancel={() => setEditingDraftIndex(null)}
              saving={draftSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
}

