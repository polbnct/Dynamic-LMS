"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";
import { getCourseById, getCurrentProfessorId } from "@/lib/supabase/queries/courses.client";
import { getLessons, type Lesson } from "@/lib/supabase/queries/lessons";
import {
  createQuestion,
  deleteQuestion,
  getQuestions,
  getQuizzes,
  setQuizQuestions,
  type Question as DBQuestion,
  updateQuestion,
} from "@/lib/supabase/queries/quizzes";
import { buildQuestionSignature } from "@/lib/questions/signature";

type QuestionType = "multiple_choice" | "true_false" | "fill_blank";

interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: number | boolean | string;
  fillBlankAnswerMode?: "symbol_only" | "term_only" | null;
  source?: string;
  sourceType?: "lesson" | "pdf";
}

interface DraftQuestion {
  draftId: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correct_answer: number | boolean | string;
  fill_blank_answer_mode?: "symbol_only" | "term_only" | null;
  source_lesson_id?: string | null;
  source_type?: "lesson" | "pdf" | null;
}

export default function ManageQuizQuestionsPage() {
  const params = useParams();
  const courseId = params.id as string;
  const quizId = params.quizId as string;

  const [course, setCourse] = useState<any>(null);
  const [quizName, setQuizName] = useState("Quiz");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizBank, setQuizBank] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [bankQuestionFilter, setBankQuestionFilter] = useState<"all" | QuestionType>("all");
  const [bankSourceFilter, setBankSourceFilter] = useState<"all" | "manual" | string>("all");

  const [createQuestionModalOpen, setCreateQuestionModalOpen] = useState(false);
  const [editingBankQuestion, setEditingBankQuestion] = useState<Question | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    type: "multiple_choice" as QuestionType,
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    trueFalseAnswer: true,
    fillBlankAnswer: "",
    fillBlankAnswerMode: "term_only" as "symbol_only" | "term_only",
    source: "",
    sourceType: "lesson" as "lesson" | "pdf",
  });

  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateQuestionType, setGenerateQuestionType] = useState<QuestionType>("multiple_choice");
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatingForSourceId, setGeneratingForSourceId] = useState<string | null>(null);
  const [generatedDraftQuestions, setGeneratedDraftQuestions] = useState<DraftQuestion[]>([]);
  const [selectedGeneratedDraftIds, setSelectedGeneratedDraftIds] = useState<string[]>([]);
  const [approvingGeneratedDrafts, setApprovingGeneratedDrafts] = useState(false);

  useSyncMessagesToToast(error, success);

  useEffect(() => {
    async function load() {
      try {
        const [courseData, quizzesData, questionsData, lessonsData] = await Promise.all([
          getCourseById(courseId),
          getQuizzes(courseId),
          getQuestions(courseId, undefined, { includeStudyAid: false }),
          getLessons(courseId),
        ]);
        setCourse(courseData);
        setLessons(lessonsData);
        const quiz = quizzesData.find((q) => q.id === quizId);
        if (!quiz) {
          throw new Error("Quiz not found.");
        }
        setQuizName(quiz.name);

        const bank = questionsData.map((q) => ({
          id: q.id,
          type: q.type as QuestionType,
          question: q.question,
          options: q.options,
          correctAnswer: q.correct_answer,
          fillBlankAnswerMode: q.fill_blank_answer_mode ?? "term_only",
          source: q.source_lesson_id,
          sourceType: q.source_type ?? undefined,
        }));
        setQuizBank(bank);

        const selected = (quiz.questions ?? []).map((q: DBQuestion) => ({
          id: q.id,
          type: q.type as QuestionType,
          question: q.question,
          options: q.options,
          correctAnswer: q.correct_answer,
          fillBlankAnswerMode: q.fill_blank_answer_mode ?? "term_only",
          source: q.source_lesson_id,
          sourceType: q.source_type ?? undefined,
        }));
        setSelectedQuestions(selected);
      } catch (err: any) {
        setError(err?.message || "Failed to load quiz question manager.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, quizId]);

  const selectedIds = useMemo(() => new Set(selectedQuestions.map((q) => q.id)), [selectedQuestions]);

  const sourceFilterOptions = useMemo(() => {
    const lessonNameById = new Map(lessons.map((l) => [l.id, l.title]));
    const ids = Array.from(new Set(quizBank.map((q) => q.source).filter((x): x is string => Boolean(x))));
    return ids.map((id) => ({ id, name: lessonNameById.get(id) ?? "Unknown lesson" }));
  }, [lessons, quizBank]);

  const displayedBank = useMemo(() => {
    let list = quizBank.filter((q) => !selectedIds.has(q.id));
    if (bankQuestionFilter !== "all") list = list.filter((q) => q.type === bankQuestionFilter);
    if (bankSourceFilter === "manual") list = list.filter((q) => !q.source);
    else if (bankSourceFilter !== "all") list = list.filter((q) => q.source === bankSourceFilter);
    return list;
  }, [quizBank, selectedIds, bankQuestionFilter, bankSourceFilter]);

  const handleSaveSelection = async () => {
    try {
      setSaving(true);
      setError("");
      await setQuizQuestions(
        quizId,
        selectedQuestions.map((q) => q.id)
      );
      if (typeof window !== "undefined" && window.opener) {
        try {
          window.opener.postMessage(
            {
              type: "quiz-questions-updated",
              quizId,
              courseId,
            },
            "*"
          );
        } catch (syncErr) {
          console.warn("Quiz question sync event failed:", syncErr);
        }
      }
      setSuccess("Quiz questions updated.");
      // This page is opened in a new tab from Quiz Settings; close it after successful save.
      window.close();
      // Fallback when browser blocks close (e.g., tab not script-opened).
      setTimeout(() => {
        if (typeof window !== "undefined" && !window.closed) {
          window.history.back();
        }
      }, 150);
      setTimeout(() => setSuccess(""), 2500);
    } catch (err: any) {
      setError(err?.message || "Failed to save quiz questions.");
    } finally {
      setSaving(false);
    }
  };

  const openCreateQuestion = () => {
    setEditingBankQuestion(null);
    setEditingDraftId(null);
    setNewQuestion({
      type: "multiple_choice",
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      trueFalseAnswer: true,
      fillBlankAnswer: "",
      fillBlankAnswerMode: "term_only",
      source: "",
      sourceType: "lesson",
    });
    setCreateQuestionModalOpen(true);
  };

  const openEditQuestion = (question: Question) => {
    setEditingBankQuestion(question);
    setEditingDraftId(null);
    setNewQuestion({
      type: question.type,
      question: question.question,
      options: question.type === "multiple_choice" ? (question.options ?? ["", "", "", ""]) : ["", "", "", ""],
      correctAnswer: typeof question.correctAnswer === "number" ? question.correctAnswer : 0,
      trueFalseAnswer: Boolean(question.correctAnswer),
      fillBlankAnswer: question.type === "fill_blank" ? String(question.correctAnswer ?? "") : "",
      fillBlankAnswerMode: question.fillBlankAnswerMode ?? "term_only",
      source: question.source ?? "",
      sourceType: question.sourceType ?? "lesson",
    });
    setCreateQuestionModalOpen(true);
  };

  const openEditDraft = (draft: DraftQuestion) => {
    setEditingBankQuestion(null);
    setEditingDraftId(draft.draftId);
    setNewQuestion({
      type: draft.type,
      question: draft.question,
      options:
        draft.type === "multiple_choice"
          ? (Array.isArray(draft.options) && draft.options.length === 4
              ? draft.options
              : ["", "", "", ""])
          : ["", "", "", ""],
      correctAnswer:
        draft.type === "multiple_choice"
          ? (typeof draft.correct_answer === "number" ? draft.correct_answer : 0)
          : 0,
      trueFalseAnswer: draft.type === "true_false" ? Boolean(draft.correct_answer) : true,
      fillBlankAnswer: draft.type === "fill_blank" ? String(draft.correct_answer ?? "") : "",
      fillBlankAnswerMode: draft.fill_blank_answer_mode ?? "term_only",
      source: draft.source_lesson_id ?? "",
      sourceType: (draft.source_type as "lesson" | "pdf") ?? "lesson",
    });
    setCreateQuestionModalOpen(true);
  };

  const handleCreateOrUpdateQuestion = async () => {
    try {
      setError("");
      if (!newQuestion.question.trim()) {
        setError("Please enter a question.");
        return;
      }
      if (newQuestion.type === "multiple_choice" && newQuestion.options.some((opt) => !opt.trim())) {
        setError("Please fill all option fields.");
        return;
      }
      if (newQuestion.type === "fill_blank" && !newQuestion.fillBlankAnswer.trim()) {
        setError("Please enter the correct fill-in-the-blank answer.");
        return;
      }
      const professorId = await getCurrentProfessorId(true);
      if (!professorId) throw new Error("Professor not found.");

      const payload = {
        type: newQuestion.type,
        question: newQuestion.question.trim(),
        options: newQuestion.type === "multiple_choice" ? newQuestion.options : null,
        correct_answer:
          newQuestion.type === "multiple_choice"
            ? newQuestion.correctAnswer
            : newQuestion.type === "true_false"
              ? newQuestion.trueFalseAnswer
              : newQuestion.fillBlankAnswer,
        fill_blank_answer_mode: newQuestion.type === "fill_blank" ? newQuestion.fillBlankAnswerMode : null,
        source_lesson_id: newQuestion.source || null,
        source_type: newQuestion.source ? newQuestion.sourceType : null,
      };

      if (editingDraftId) {
        const updatedDraft: DraftQuestion = {
          draftId: editingDraftId,
          type: newQuestion.type,
          question: newQuestion.question.trim(),
          options: newQuestion.type === "multiple_choice" ? newQuestion.options : undefined,
          correct_answer:
            newQuestion.type === "multiple_choice"
              ? newQuestion.correctAnswer
              : newQuestion.type === "true_false"
                ? newQuestion.trueFalseAnswer
                : newQuestion.fillBlankAnswer.trim(),
          fill_blank_answer_mode:
            newQuestion.type === "fill_blank" ? newQuestion.fillBlankAnswerMode : null,
          source_lesson_id: newQuestion.source || null,
          source_type: newQuestion.source ? newQuestion.sourceType : null,
        };
        setGeneratedDraftQuestions((prev) =>
          prev.map((draft) => (draft.draftId === editingDraftId ? updatedDraft : draft))
        );
        setCreateQuestionModalOpen(false);
        setEditingDraftId(null);
        setSuccess("Draft updated.");
        setTimeout(() => setSuccess(""), 2500);
        return;
      }

      const question = editingBankQuestion
        ? await updateQuestion(editingBankQuestion.id, payload)
        : await createQuestion({
            course_id: courseId,
            professor_id: professorId,
            type: payload.type,
            question: payload.question,
            options: payload.options ?? undefined,
            correct_answer: payload.correct_answer,
            fill_blank_answer_mode: payload.fill_blank_answer_mode,
            source_lesson_id: payload.source_lesson_id ?? undefined,
            source_type: payload.source_type ?? undefined,
          });

      const transformed: Question = {
        id: question.id,
        type: question.type as QuestionType,
        question: question.question,
        options: question.options,
        correctAnswer: question.correct_answer,
        fillBlankAnswerMode: question.fill_blank_answer_mode ?? "term_only",
        source: question.source_lesson_id,
        sourceType: question.source_type ?? undefined,
      };

      setQuizBank((prev) =>
        editingBankQuestion ? prev.map((q) => (q.id === transformed.id ? transformed : q)) : [...prev, transformed]
      );
      setSelectedQuestions((prev) =>
        editingBankQuestion ? prev.map((q) => (q.id === transformed.id ? transformed : q)) : prev
      );
      setCreateQuestionModalOpen(false);
      setEditingDraftId(null);
      setSuccess(editingBankQuestion ? "Question updated." : "Question created.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err: any) {
      setError(err?.message || "Failed to save question.");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await deleteQuestion(questionId);
      setQuizBank((prev) => prev.filter((q) => q.id !== questionId));
      setSelectedQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (err: any) {
      setError(err?.message || "Failed to delete question.");
    }
  };

  const handleGenerateFromLesson = async (lessonId: string) => {
    try {
      setGeneratingQuestions(true);
      setGeneratingForSourceId(lessonId);
      const response = await fetch("/api/gemini/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, questionType: generateQuestionType, count: 5 }),
      });
      if (!response.ok) throw new Error("Failed to generate questions");
      const { questions } = await response.json();
      const seen = new Set<string>();
      const bankSignatures = new Set(
        quizBank.map((q) =>
          buildQuestionSignature({
            type: q.type,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
          })
        )
      );
      const drafts: DraftQuestion[] = [];
      for (const q of Array.isArray(questions) ? questions : []) {
        const sig = buildQuestionSignature({
          type: q.type,
          question: q.question,
          options: q.options,
          correctAnswer: q.correct_answer,
        });
        if (seen.has(sig) || bankSignatures.has(sig)) continue;
        seen.add(sig);
        drafts.push({
          draftId: `draft-${Date.now()}-${drafts.length}`,
          type: q.type,
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          fill_blank_answer_mode: q.fill_blank_answer_mode ?? "term_only",
          source_lesson_id: lessonId,
          source_type: "lesson",
        });
      }
      setGeneratedDraftQuestions((prev) => [...prev, ...drafts]);
      setSelectedGeneratedDraftIds((prev) => [...new Set([...prev, ...drafts.map((d) => d.draftId)])]);
      setGenerateModalOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to generate drafts.");
    } finally {
      setGeneratingQuestions(false);
      setGeneratingForSourceId(null);
    }
  };

  const handleApproveDrafts = async () => {
    try {
      setApprovingGeneratedDrafts(true);
      const professorId = await getCurrentProfessorId(true);
      if (!professorId) throw new Error("Professor not found");
      const selectedSet = new Set(selectedGeneratedDraftIds);
      const toApprove = generatedDraftQuestions.filter((q) => selectedSet.has(q.draftId));
      const results = await Promise.allSettled(
        toApprove.map((q) =>
          createQuestion({
            course_id: courseId,
            professor_id: professorId,
            type: q.type,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            fill_blank_answer_mode: q.type === "fill_blank" ? (q.fill_blank_answer_mode ?? "term_only") : null,
            source_lesson_id: q.source_lesson_id ?? undefined,
            source_type: q.source_type ?? undefined,
          })
        )
      );

      const added = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value)
        .map((q) => ({
          id: q.id,
          type: q.type as QuestionType,
          question: q.question,
          options: q.options,
          correctAnswer: q.correct_answer,
          fillBlankAnswerMode: q.fill_blank_answer_mode ?? "term_only",
          source: q.source_lesson_id,
          sourceType: q.source_type ?? undefined,
        }));
      setQuizBank((prev) => [...prev, ...added]);
      // Auto-clear all remaining unapproved drafts after approval action.
      setGeneratedDraftQuestions([]);
      setSelectedGeneratedDraftIds([]);
      setSuccess(`Approved ${added.length} draft question${added.length !== 1 ? "s" : ""}.`);
      setTimeout(() => setSuccess(""), 2500);
    } catch (err: any) {
      setError(err?.message || "Failed approving drafts.");
    } finally {
      setApprovingGeneratedDrafts(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <p className="text-sm text-gray-900">{course?.name} ({course?.code})</p>
              <h1 className="text-2xl font-bold text-gray-900">Manage Questions: {quizName}</h1>
            </div>
            <button
              type="button"
              onClick={handleSaveSelection}
              disabled={saving}
              className="w-full sm:w-auto rounded-lg border border-red-600 bg-red-600 px-3 py-2.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {saving ? "Saving..." : "Save Selection"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-2xl border border-gray-200 bg-white xl:col-span-5 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Selected Questions</h2>
                <p className="text-xs text-gray-900">{selectedQuestions.length} currently in this quiz</p>
              </div>
              <button type="button" onClick={() => setSelectedQuestions([])} className="text-sm font-medium text-gray-900 hover:text-black shrink-0">
                Clear all
              </button>
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
              {selectedQuestions.length === 0 ? (
                <p className="text-sm text-gray-900">No selected questions yet.</p>
              ) : (
                selectedQuestions.map((q) => (
                  <article key={q.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-wide text-gray-900">{q.type.replace("_", " ")}</p>
                        <p className="text-sm text-gray-900 break-words whitespace-normal">{q.question}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditQuestion(q)}
                          className="rounded-md border border-gray-300 bg-white px-2 sm:px-3 py-1 text-xs font-medium text-gray-900 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedQuestions((prev) => prev.filter((x) => x.id !== q.id))}
                          className="rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white xl:col-span-7">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Question Bank</h2>
                  <p className="text-xs text-gray-900">{displayedBank.length} available based on current filters</p>
                </div>
                <div className="flex w-full sm:w-auto items-center gap-2">
                  <button onClick={() => setGenerateModalOpen(true)} className="flex-1 sm:flex-initial rounded-md border border-red-600 bg-red-600 px-10 py-2 sm:px -3 sm:py-1.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer">
                    Generate
                  </button>
                  <button onClick={openCreateQuestion} className="flex-1 sm:flex-initial rounded-md border border-gray-300 bg-white px-10 py-2 sm:px -3 sm:py-1.5 text-xs font-semibold text-gray-900 hover:bg-slate-100 cursor-pointer">
                    Create
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select value={bankQuestionFilter} onChange={(e) => setBankQuestionFilter(e.target.value as "all" | QuestionType)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900">
                  <option value="all">All types</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True or False</option>
                  <option value="fill_blank">Fill in the Blank</option>
                </select>
                <select value={bankSourceFilter} onChange={(e) => setBankSourceFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900">
                  <option value="all">All sources</option>
                  <option value="manual">Created manually</option>
                  {sourceFilterOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      Lesson: {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              {generatedDraftQuestions.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">Generated Drafts</p>
                    <span className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-900">
                      {generatedDraftQuestions.length} drafts
                    </span>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {generatedDraftQuestions.map((q) => (
                      <li key={q.draftId} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex min-w-0 items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selectedGeneratedDraftIds.includes(q.draftId)}
                              onChange={() =>
                                setSelectedGeneratedDraftIds((prev) =>
                                  prev.includes(q.draftId) ? prev.filter((id) => id !== q.draftId) : [...prev, q.draftId]
                                )
                              }
                            />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-700">
                                {q.type.replace("_", " ")}
                              </span>
                              <span className="block break-words text-sm text-gray-900">{q.question}</span>
                            </span>
                          </label>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditDraft(q)}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setGeneratedDraftQuestions((prev) => prev.filter((draft) => draft.draftId !== q.draftId));
                                setSelectedGeneratedDraftIds((prev) => prev.filter((id) => id !== q.draftId));
                              }}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={handleApproveDrafts}
                      disabled={approvingGeneratedDrafts}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-900 bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {approvingGeneratedDrafts ? "Approving..." : "Approve Selected"}
                    </button>
                    <button
                      onClick={() => {
                        setGeneratedDraftQuestions([]);
                        setSelectedGeneratedDraftIds([]);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50"
                    >
                      Discard All
                    </button>
                  </div>
                </div>
              )}

              {displayedBank.length === 0 ? (
                <p className="text-sm text-gray-900">No questions available for the selected filters.</p>
              ) : (
                <ul className="space-y-2">
                  {displayedBank.map((q) => (
                    <li key={q.id} className="rounded-lg border border-gray-200 px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-wide text-gray-900 shrink-0">
                            {q.type.replace("_", " ")}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => openEditQuestion(q)}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2 sm:px-3 py-1 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-slate-100 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2 sm:px-3 py-1 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-slate-100 cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setSelectedQuestions((prev) => [...prev, q])}
                              className="inline-flex items-center justify-center rounded-lg border border-red-600 bg-red-600 px-2 sm:px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 cursor-pointer"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-900 break-words whitespace-normal">
                          {q.question}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>

      {createQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-xl font-bold text-gray-900">
              {editingDraftId ? "Edit Draft Question" : editingBankQuestion ? "Edit Question" : "Create Question"}
              </h3>
              <p className="mt-1 text-sm text-gray-600">Refine details before saving to the question bank.</p>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
              <select
                value={newQuestion.type}
                onChange={(e) =>
                  setNewQuestion((prev) => ({
                    ...prev,
                    type: e.target.value as QuestionType,
                    correctAnswer: 0,
                    trueFalseAnswer: true,
                    fillBlankAnswer: prev.type === "fill_blank" ? prev.fillBlankAnswer : "",
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True or False</option>
                <option value="fill_blank">Fill in the Blank</option>
              </select>
              <input
                value={newQuestion.question}
                onChange={(e) => setNewQuestion((prev) => ({ ...prev, question: e.target.value }))}
                placeholder="Question"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500"
              />
              </div>

              {newQuestion.type === "multiple_choice" && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">Options</label>
                  {newQuestion.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 text-sm font-semibold text-gray-900">{String.fromCharCode(65 + idx)}.</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...newQuestion.options];
                          next[idx] = e.target.value;
                          setNewQuestion((prev) => ({ ...prev, options: next }));
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500"
                      />
                      <label className="inline-flex items-center gap-1 text-xs font-medium text-gray-900">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={newQuestion.correctAnswer === idx}
                          onChange={() => setNewQuestion((prev) => ({ ...prev, correctAnswer: idx }))}
                        />
                        Correct
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {newQuestion.type === "true_false" && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <label className="mb-3 block text-center text-sm font-semibold text-gray-900">Correct Answer</label>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewQuestion((prev) => ({ ...prev, trueFalseAnswer: true }))}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                        newQuestion.trueFalseAnswer
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      True
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewQuestion((prev) => ({ ...prev, trueFalseAnswer: false }))}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                        !newQuestion.trueFalseAnswer
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      False
                    </button>
                  </div>
                </div>
              )}

              {newQuestion.type === "fill_blank" && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Correct Answer</label>
                    <input
                      type="text"
                      value={newQuestion.fillBlankAnswer}
                      onChange={(e) => setNewQuestion((prev) => ({ ...prev, fillBlankAnswer: e.target.value }))}
                      placeholder="Enter the correct answer"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Answer Mode Tag</label>
                    <select
                      value={newQuestion.fillBlankAnswerMode}
                      onChange={(e) =>
                        setNewQuestion((prev) => ({
                          ...prev,
                          fillBlankAnswerMode: e.target.value as "symbol_only" | "term_only",
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="term_only">Term only</option>
                      <option value="symbol_only">Symbol only</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <label className="block text-sm font-semibold text-gray-900 mb-1">Source</label>
                <select
                  value={newQuestion.source}
                  onChange={(e) => setNewQuestion((prev) => ({ ...prev, source: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">None</option>
                  {[...lessons]
                    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }))
                    .map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setCreateQuestionModalOpen(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateOrUpdateQuestion} className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {generateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4">
            <h3 className="text-lg font-semibold text-gray-900">Generate Questions</h3>
            <select value={generateQuestionType} onChange={(e) => setGenerateQuestionType(e.target.value as QuestionType)} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900">
              <option value="multiple_choice">Multiple Choice</option>
              <option value="true_false">True or False</option>
              <option value="fill_blank">Fill in the Blank</option>
            </select>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {[...lessons]
                .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }))
                .map((lesson) => {
                  const isGenerating = generatingForSourceId === lesson.id;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => !generatingQuestions && handleGenerateFromLesson(lesson.id)}
                        disabled={generatingQuestions}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900">{lesson.title}</span>
                          {isGenerating && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                              <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Generating...
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>
            <div className="mt-3 flex justify-end">
              <button onClick={() => setGenerateModalOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

