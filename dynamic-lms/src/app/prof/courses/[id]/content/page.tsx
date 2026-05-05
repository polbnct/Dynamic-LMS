"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import CourseNavbar from "@/utils/CourseNavbar";
import { getCourseById, updateCourseLessonSettings } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { useSyncMessagesToToast } from "@/components/feedback/ToastProvider";
import { getLessons, createLesson, updateLesson, deleteLesson, uploadLessonPDF, getLessonPDFUrl } from "@/lib/supabase/queries/lessons";
import type { Lesson } from "@/lib/supabase/queries/lessons";
import {
  getLessonStudyQuestions,
  addLessonStudyQuestions,
  removeLessonStudyQuestion,
  updateLessonStudyQuestion,
  type StudyAidQuestion,
} from "@/lib/supabase/queries/study-aid";
import { buildQuestionSignature } from "@/lib/questions/signature";

type LessonWithUI = Lesson & {
  pdfUrl?: string;
  pdfFileName?: string;
  createdAt?: string;
};

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
    question.type === "multiple_choice" && question.options?.length
      ? question.options
      : ["", "", "", ""]
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
      question.correct_answer &&
      typeof question.correct_answer === "object" &&
      "answer" in question.correct_answer
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
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {type === "true_false" ? "Front of flashcard (term/concept)" : "Question text"}
        </label>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 text-gray-900 rounded-xl text-sm min-h-[88px] focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow"
          placeholder={type === "true_false" ? "Enter the front term or concept..." : "Enter the question..."}
          required
        />
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Question type</label>
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as "multiple_choice" | "true_false" | "fill_blank" | "summary")
            }
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
          >
            <option value="multiple_choice">Multiple choice</option>
            <option value="true_false">Flashcard</option>
            <option value="fill_blank">Fill in the blank</option>
            <option value="summary">Summary</option>
          </select>
      </div>
      {type === "multiple_choice" && (
        <>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Answer options</label>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-red-100 text-red-700 text-xs font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input
                    value={options[i] ?? ""}
                    onChange={(e) =>
                      setOptions((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Correct answer</label>
            <select
              value={correctAnswerMc}
              onChange={(e) => setCorrectAnswerMc(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
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
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Back of flashcard (explanation)</label>
          <textarea
            value={correctAnswerFlashcard}
            onChange={(e) => setCorrectAnswerFlashcard(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 min-h-[88px] focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Enter the explanation/definition shown on the back..."
          />
        </div>
      )}
      {type === "fill_blank" && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Correct answer</label>
          <input
            type="text"
            value={correctAnswerFill}
            onChange={(e) => setCorrectAnswerFill(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Answer that fills the blank"
          />
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5 mt-3">
            Answer mode tag
          </label>
          <select
            value={fillBlankAnswerMode}
            onChange={(e) =>
              setFillBlankAnswerMode(e.target.value as "symbol_only" | "term_only")
            }
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
          >
            <option value="term_only">Term only</option>
            <option value="symbol_only">Symbol only</option>
          </select>
        </div>
      )}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          Brief feedback for correct answer
        </label>
        <textarea
          value={correctFeedback}
          onChange={(e) => setCorrectFeedback(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 min-h-[84px] focus:ring-2 focus:ring-red-500 focus:border-red-500"
          placeholder="Explain briefly why this is the correct answer..."
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:from-red-700 hover:to-rose-700 disabled:opacity-50 transition-all"
        >
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ContentPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<LessonWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLessonModalOpen, setAddLessonModalOpen] = useState(false);
  const [editLessonModalOpen, setEditLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonWithUI | null>(null);
  const [editLessonForm, setEditLessonForm] = useState({
    title: "",
    category: "prelim" as "prelim" | "midterm" | "finals",
    pdfFile: null as File | null,
  });
  const [updatingLesson, setUpdatingLesson] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "prelim" as "prelim" | "midterm" | "finals",
    pdfFile: null as File | null,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [studyAidLesson, setStudyAidLesson] = useState<LessonWithUI | null>(null);
  const [studyAidQuestions, setStudyAidQuestions] = useState<StudyAidQuestion[]>([]);
  const [generatedForStudy, setGeneratedForStudy] = useState<any[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<number>>(new Set());
  const [studyAidGenerateType, setStudyAidGenerateType] = useState<"summary" | "flashcard" | "multiple_choice" | "fill_blank">("multiple_choice");
  const [studyAidGenerateCount, setStudyAidGenerateCount] = useState(1);
  const [studyAidLoading, setStudyAidLoading] = useState(false);
  const [studyAidGenerating, setStudyAidGenerating] = useState(false);
  const [studyAidAdding, setStudyAidAdding] = useState(false);
  const [editingStudyQuestion, setEditingStudyQuestion] = useState<StudyAidQuestion | null>(null);
  const [studyAidSaving, setStudyAidSaving] = useState(false);
  const [selectedStudyAidIds, setSelectedStudyAidIds] = useState<Set<string>>(new Set());
  const [deletingSelectedStudyAids, setDeletingSelectedStudyAids] = useState(false);
  const [studyAidViewType, setStudyAidViewType] = useState<"summary" | "true_false" | "fill_blank" | "multiple_choice">("summary");
  const [studyAidSearch, setStudyAidSearch] = useState("");
  const [studyAidPage, setStudyAidPage] = useState(1);
  const [editModalTab, setEditModalTab] = useState<"lesson" | "lesson_settings">("lesson");
  const [unlockThresholdPercent, setUnlockThresholdPercent] = useState(70);
  const [shuffleStudyAidQuestions, setShuffleStudyAidQuestions] = useState(true);
  const [savingUnlockThreshold, setSavingUnlockThreshold] = useState(false);
  const { handledCourses } = useProfessorCourses();
  const [creatingLesson, setCreatingLesson] = useState(false);

  useSyncMessagesToToast(error, success);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    message: string;
    confirmButtonText: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const openDeleteConfirm = (options: {
    title: string;
    message: string;
    confirmButtonText?: string;
    onConfirm: () => Promise<void>;
  }) => {
    setDeleteConfirm({
      title: options.title,
      message: options.message,
      confirmButtonText: options.confirmButtonText ?? "Delete",
      onConfirm: options.onConfirm,
    });
  };

  const closeDeleteConfirm = () => {
    if (!confirmingDelete) setDeleteConfirm(null);
  };

  useEffect(() => {
  setSelectedStudyAidIds((prev) => {
    const validIds = new Set(studyAidQuestions.map((q) => q.id));
    return new Set(Array.from(prev).filter((id) => validIds.has(id)));
  });
}, [studyAidQuestions]);

const getValidatedStudyAidCount = (
  type: "summary" | "flashcard" | "multiple_choice" | "fill_blank",
  count: number
) => {
  if (type === "summary") return 1;

  const safeCount = Number(count);
  if (!Number.isFinite(safeCount)) return 10;

  return Math.min(10, Math.max(1, safeCount));
};

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
    return orderedStudyAidQuestions.filter((item) => {
      const typeMatch = item.type === studyAidViewType;
      const textMatch = !q || item.question.toLowerCase().includes(q);
      return typeMatch && textMatch;
    });
  }, [orderedStudyAidQuestions, studyAidViewType, studyAidSearch]);

  const STUDY_AID_PAGE_SIZE = 5;
  const studyAidTotalPages = Math.max(1, Math.ceil(filteredStudyAidQuestions.length / STUDY_AID_PAGE_SIZE));
  const pagedStudyAidQuestions = useMemo(() => {
    const safePage = Math.min(studyAidPage, studyAidTotalPages);
    const start = (safePage - 1) * STUDY_AID_PAGE_SIZE;
    return filteredStudyAidQuestions.slice(start, start + STUDY_AID_PAGE_SIZE);
  }, [filteredStudyAidQuestions, studyAidPage, studyAidTotalPages]);
  const hasExistingSummary = useMemo(
    () => studyAidQuestions.some((q) => q.type === "summary"),
    [studyAidQuestions]
  );

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        setUnlockThresholdPercent(
          Math.min(
            100,
            Math.max(1, Math.round(Number(courseData?.unlock_threshold_percent ?? 70)))
          )
        );
        setShuffleStudyAidQuestions(
          courseData?.shuffle_study_aid_questions === undefined ||
          courseData?.shuffle_study_aid_questions === null
            ? true
            : Boolean(courseData.shuffle_study_aid_questions)
        );
        const lessonsData = await getLessons(courseId);
        setLessons(
          lessonsData.map((lesson) => ({
            ...lesson,
            pdfUrl: lesson.pdf_file_path ? getLessonPDFUrl(lesson.pdf_file_path) : undefined,
            pdfFileName: lesson.pdf_file_path ? lesson.pdf_file_path.split("/").pop() : undefined,
            createdAt: lesson.created_at,
          }))
        );
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file.");
        return;
      }
      setFormData({ ...formData, pdfFile: file });
      setError("");
    }
  };

  const handleEditLessonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file.");
        return;
      }
      setEditLessonForm((prev) => ({ ...prev, pdfFile: file }));
      setError("");
    }
  };

  const openEditLessonModal = (lesson: LessonWithUI) => {
    setEditingLesson(lesson);
    setStudyAidLesson(lesson);
    setEditLessonForm({
      title: lesson.title,
      category: lesson.category,
      pdfFile: null,
    });
    setEditModalTab("lesson");
    setEditingStudyQuestion(null);
    setGeneratedForStudy([]);
    setSelectedGenerated(new Set());
    if (lesson.pdf_file_path) {
      setStudyAidLoading(true);
      void getLessonStudyQuestions(lesson.id)
        .then((list) => setStudyAidQuestions(list))
        .catch(() => setStudyAidQuestions([]))
        .finally(() => setStudyAidLoading(false));
    } else {
      setStudyAidQuestions([]);
    }
    setSelectedStudyAidIds(new Set());
    setError("");
    setSuccess("");
    setEditLessonModalOpen(true);
  };

  const closeEditLessonModal = () => {
    setEditLessonModalOpen(false);
    setEditingLesson(null);
    setStudyAidLesson(null);
    setEditLessonForm({ title: "", category: "prelim", pdfFile: null });
    setSelectedStudyAidIds(new Set());
    setUpdatingLesson(false);
    setEditModalTab("lesson");
    setStudyAidViewType("summary");
    setStudyAidSearch("");
    setStudyAidPage(1);
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    if (!editLessonForm.title.trim()) {
      setError("Please enter a lesson name.");
      return;
    }
    if (updatingLesson) return;

    setUpdatingLesson(true);
    setError("");
    setSuccess("");
    try {
      const updates: Partial<Lesson> = {
        title: editLessonForm.title.trim(),
      };

      let pdfPath: string | undefined;
      if (editLessonForm.pdfFile) {
        pdfPath = await uploadLessonPDF(editLessonForm.pdfFile, courseId, editingLesson.id);
        updates.pdf_file_path = pdfPath;
      }

      const updated = await updateLesson(editingLesson.id, updates);

      setLessons((prev) =>
        prev.map((l) =>
          l.id === updated.id
            ? {
                ...l,
                ...updated,
                pdfUrl: updated.pdf_file_path ? getLessonPDFUrl(updated.pdf_file_path) : l.pdfUrl,
                pdfFileName: updated.pdf_file_path ? updated.pdf_file_path.split("/").pop() : l.pdfFileName,
                createdAt: updated.created_at,
              }
            : l
        )
      );

      if (studyAidLesson?.id === updated.id) {
        setStudyAidLesson((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                pdfUrl: updated.pdf_file_path ? getLessonPDFUrl(updated.pdf_file_path) : prev.pdfUrl,
                pdfFileName: updated.pdf_file_path ? updated.pdf_file_path.split("/").pop() : prev.pdfFileName,
                createdAt: updated.created_at,
              }
            : prev
        );
      }

      setSuccess("Lesson updated.");
      setTimeout(() => setSuccess(""), 2500);
      closeEditLessonModal();
    } catch (err: any) {
      console.error("Error updating lesson:", err);
      setError(err?.message || "Failed to update lesson.");
    } finally {
      setUpdatingLesson(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.title.trim()) {
      setError("Please enter a lesson name.");
      return;
    }

    if (!formData.pdfFile) {
      setError("Please upload a PDF file.");
      return;
    }

    if (creatingLesson) return;

    try {
      setCreatingLesson(true);
      // Calculate order
      const categoryLessons = lessons.filter((l) => l.category === formData.category);
      const order = categoryLessons.length + 1;

      // Create lesson in database first (so we have a persistent lesson ID)
      const newLesson = await createLesson(courseId, {
        title: formData.title.trim(),
        category: formData.category,
        order,
      });

      // Upload PDF with real lesson ID and professor's original file name
      const pdfPath = await uploadLessonPDF(formData.pdfFile, courseId, newLesson.id);

      // Update lesson with the stored PDF path
      await updateLesson(newLesson.id, { pdf_file_path: pdfPath });

      // Add to local state
      setLessons([
        ...lessons,
        {
          ...newLesson,
          pdf_file_path: pdfPath,
          pdfUrl: getLessonPDFUrl(pdfPath),
          pdfFileName: formData.pdfFile.name,
          createdAt: newLesson.created_at,
        },
      ]);

      setSuccess("Lesson created successfully!");

      // Reset form
      setFormData({
        title: "",
        category: "prelim",
        pdfFile: null,
      });

      // Close modal after a short delay
      setTimeout(() => {
        setAddLessonModalOpen(false);
        setSuccess("");
      }, 1000);
    } catch (err: any) {
      console.error("Error creating lesson:", err);
      setError(err.message || "Failed to create lesson. Please try again.");
    } finally {
      setCreatingLesson(false);
    }
  };

  const handleCancel = () => {
    setAddLessonModalOpen(false);
    setFormData({
      title: "",
      category: "prelim",
      pdfFile: null,
    });
    setError("");
    setSuccess("");
  };

  // Group lessons by category
  const lessonsByCategory = {
    prelim: lessons.filter((l) => l.category === "prelim"),
    midterm: lessons.filter((l) => l.category === "midterm"),
    finals: lessons.filter((l) => l.category === "finals"),
  };

  const categoryLabels = {
    prelim: "Prelim",
    midterm: "Midterm",
    finals: "Finals",
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />
        <CourseNavbar courseId={courseId} currentPage="content" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalLessons = lessons.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      {/* Professor Navbar */}
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />

      {/* Course Navbar */}
      <CourseNavbar
        courseId={courseId}
        currentPage="content"
        courseName={course?.name}
        courseCode={course?.code}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <Link
            href="/prof/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-red-600 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 break-words">
                Course Content
              </h1>
              <p className="text-sm sm:text-base text-gray-600 truncate" title={course.name}>
                {course?.name} ({course?.code}) • {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => setAddLessonModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:from-red-700 hover:to-rose-700 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Lesson
            </button>
          </div>
        </div>

        {/* Lessons by Category */}
        {totalLessons === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-rose-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No lessons yet</h3>
              <p className="text-gray-600 mb-6">Add your first lesson to get started</p>
              <button
                onClick={() => setAddLessonModalOpen(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Lesson
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {(["prelim", "midterm", "finals"] as const).map((category) => {
              const categoryLessons = lessonsByCategory[category];
              if (categoryLessons.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                    <h2 className="text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                  <span className="inline-flex items-center rounded-full border border-gray-900 bg-white px-3 py-1 text-sm font-semibold text-gray-900">
                      {categoryLessons.length} lesson{categoryLessons.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Lessons in Category */}
                  <div className="space-y-3">
                    {categoryLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="hidden sm:flex flex-shrink-0 w-12 h-12 bg-gradient-to-br from-red-100 to-rose-100 rounded-xl items-center justify-center">
                              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-md lg:text-lg font-bold text-gray-800 mb-1 truncate" title={lesson.title}>
                                {lesson.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-500">
                                {lesson.pdfFileName && (
                                  <div className="flex items-center gap-1 min-w-0">
                                    <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                    {lesson.pdfUrl ? (
                                      <a
                                        href={lesson.pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate text-red-700 hover:text-red-800 hover:underline"
                                        title="Open PDF"
                                      >
                                        {lesson.pdfFileName}
                                      </a>
                                    ) : (
                                      <span className="truncate">{lesson.pdfFileName}</span>
                                    )}
                                  </div>
                                )}
                                {lesson.createdAt && (
                                  <span>
                                    Created: {new Date(lesson.createdAt).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditLessonModal(lesson)}
                              className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit lesson"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openDeleteConfirm({
                                  title: `Delete lesson "${lesson.title}"?`,
                                  message: "This cannot be undone.",
                                  confirmButtonText: "Delete lesson",
                                  onConfirm: async () => {
                                    setError("");
                                    setSuccess("");
                                    try {
                                      await deleteLesson(lesson.id);
                                      setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
                                      if (studyAidLesson?.id === lesson.id) {
                                        setStudyAidLesson(null);
                                        setStudyAidQuestions([]);
                                        setEditingStudyQuestion(null);
                                        setGeneratedForStudy([]);
                                        setSelectedGenerated(new Set());
                                      }
                                      setSuccess("Lesson deleted.");
                                      setTimeout(() => setSuccess(""), 2500);
                                    } catch (err: any) {
                                      console.error("Error deleting lesson:", err);
                                      setError(err?.message || "Failed to delete lesson.");
                                    }
                                  },
                                });
                              }}
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete lesson"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Lesson Modal */}
      {addLessonModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCancel}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 transform transition-all max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  Add New Lesson
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Lesson Name */}
                <div>
                  <label htmlFor="lessonName" className="block text-sm font-semibold text-gray-700 mb-2">
                    Lesson Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>
                    <input
                      id="lessonName"
                      type="text"
                      maxLength={56}
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter lesson name"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
                    Category
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                    </div>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value as "prelim" | "midterm" | "finals" })
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white appearance-none cursor-pointer"
                    >
                      <option value="prelim">Prelim</option>
                      <option value="midterm">Midterm</option>
                      <option value="finals">Finals</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* PDF Upload */}
                <div>
                  <label htmlFor="pdfFile" className="block text-sm font-semibold text-gray-700 mb-2">
                    PDF File
                  </label>
                  <div className="relative">
                    <input
                      id="pdfFile"
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                    />
                  </div>
                  {formData.pdfFile && (
                    <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {formData.pdfFile.name}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Upload a PDF file for this lesson</p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingLesson}
                    className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:from-red-700 hover:to-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
                  >
                    {creatingLesson ? "Adding..." : "Add Lesson"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit Lesson Modal */}
      {editLessonModalOpen && editingLesson && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeEditLessonModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 transform transition-all max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                Edit Lesson
              </h2>
              <button
                onClick={closeEditLessonModal}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-5 border-b border-gray-200">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalTab("lesson")}
                  className={`flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                    editModalTab === "lesson"
                      ? "text-red-700 border-red-600"
                      : "text-gray-600 border-transparent hover:text-red-600"
                  }`}
                >
                  Lesson Details
                </button>
                <button
                  type="button"
                  onClick={() => setEditModalTab("lesson_settings")}
                  className={`flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                    editModalTab === "lesson_settings"
                      ? "text-red-700 border-red-600"
                      : "text-gray-600 border-transparent hover:text-red-600"
                  }`}
                >
                  Lesson Setting
                </button>
              </div>
            </div>

            {editModalTab === "lesson" ? (
              <form onSubmit={handleUpdateLesson} className="space-y-4">
                <div>
                  <label htmlFor="editLessonName" className="block text-sm font-semibold text-gray-700 mb-2">
                    Lesson Name
                  </label>
                  <input
                    id="editLessonName"
                    type="text"
                    maxLength={56}
                    value={editLessonForm.title}
                    onChange={(e) => setEditLessonForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent bg-gray-50/50 focus:bg-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="editLessonCategory" className="block text-sm font-semibold text-gray-700 mb-2">
                    Category
                  </label>
                  <input
                    id="editLessonCategory"
                    type="text"
                    value={editingLesson.category.charAt(0).toUpperCase() + editingLesson.category.slice(1)}
                    readOnly
                    disabled
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-600 bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Replace PDF <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    id="editLessonPdf"
                    type="file"
                    accept="application/pdf"
                    onChange={handleEditLessonFileChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-700 bg-gray-50/50 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
                  />
                  {editingLesson.pdfFileName && (
                    <p className="mt-2 text-xs text-gray-500">
                      Current PDF: <span className="font-medium">{editingLesson.pdfFileName}</span>
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    disabled={!editingLesson.pdf_file_path}
                    onClick={() =>
                      window.open(
                        `/prof/courses/${courseId}/content/${editingLesson.id}/study-aid`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                      editingLesson.pdf_file_path
                        ? "border-gray-300 bg-white text-gray-900 hover:bg-slate-100"
                        : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                    }`}
                  >
                    Manage Study Aids
                  </button>
                  {!editingLesson.pdf_file_path && (
                    <p className="mt-2 text-xs text-gray-500">
                      Upload a PDF first to enable Study Aid management.
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditLessonModal}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl cursor-pointer font-semibold hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingLesson}
                    className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:from-red-700 hover:to-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
                  >
                    {updatingLesson ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            ) : editModalTab === "lesson_settings" ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Required percentage to unlock next lesson
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={unlockThresholdPercent}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) {
                          setUnlockThresholdPercent(70);
                          return;
                        }
                        setUnlockThresholdPercent(Math.min(100, Math.max(1, Math.round(raw))));
                      }}
                      className="w-full sm:w-36 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <span className="text-sm text-gray-600 leading-none">%</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Study aid question order
                    </label>
                    <label className="inline-flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={shuffleStudyAidQuestions}
                        onChange={(e) => setShuffleStudyAidQuestions(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">Shuffle question order for students</span>
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={savingUnlockThreshold}
                      onClick={async () => {
                        try {
                          setSavingUnlockThreshold(true);
                          setError("");
                          await updateCourseLessonSettings(courseId, {
                            unlock_threshold_percent: unlockThresholdPercent,
                            shuffle_study_aid_questions: shuffleStudyAidQuestions,
                          });
                          setCourse((prev: any) =>
                            prev
                              ? {
                                  ...prev,
                                  unlock_threshold_percent: unlockThresholdPercent,
                                  shuffle_study_aid_questions: shuffleStudyAidQuestions,
                                }
                              : prev
                          );
                          setSuccess("Lesson settings updated.");
                          setTimeout(() => setSuccess(""), 2500);
                        } catch (e: any) {
                          setError(e?.message || "Failed to update lesson settings.");
                        } finally {
                          setSavingUnlockThreshold(false);
                        }
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-semibold rounded-xl hover:from-red-700 hover:to-rose-700 disabled:opacity-50 cursor-pointer"
                    >
                      {savingUnlockThreshold ? "Saving..." : "Save settings"}
                    </button>
                  </div>
                </div>
              </div>
            ) : !editingLesson.pdf_file_path ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Upload a PDF to this lesson first, then you can manage Study Aid here.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current study aid — card */}
                <section className="rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                  <div className="px-4 sm:px-5 py-4 border-b border-gray-200 bg-white flex flex-wrap items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <h3 className="flex-1 min-w-0 font-semibold text-gray-800 break-words">Your study aid questions</h3>
                    {studyAidQuestions.length > 0 && (
                      <span className="shrink-0 text-xs sm:text-sm font-medium text-red-600 bg-red-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                        {studyAidQuestions.length} question{studyAidQuestions.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="p-4 sm:p-5">
                    {studyAidLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                        <svg className="animate-spin w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading…
                      </div>
                    ) : studyAidQuestions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600 font-medium">No questions yet</p>
                        <p className="text-gray-500 text-sm mt-1">Generate questions below and add them here.</p>
                      </div>
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
                                  setStudyAidPage(1);
                                  setSelectedStudyAidIds(new Set());
                                }}
                                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
                                  studyAidViewType === tab.key
                                    ? "bg-red-600 text-white border-red-600"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-red-300"
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
                                setStudyAidPage(1);
                              }}
                              placeholder="Search questions..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            />
                          </div>
                        </div>
                        
                        {filteredStudyAidQuestions.length > 0 && (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={
                                  pagedStudyAidQuestions.length > 0 &&
                                  pagedStudyAidQuestions.every((q) => selectedStudyAidIds.has(q.id))
                                }
                                onChange={(e) => {
                                  setSelectedStudyAidIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) {
                                      pagedStudyAidQuestions.forEach((q) => next.add(q.id));
                                    } else {
                                      pagedStudyAidQuestions.forEach((q) => next.delete(q.id));
                                    }
                                    return next;
                                  });
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                              Select all on this page
                            </label>

                            <button
                              type="button"
                              disabled={selectedStudyAidIds.size === 0 || deletingSelectedStudyAids || !studyAidLesson}
                              onClick={() => {
                                if (!studyAidLesson || selectedStudyAidIds.size === 0) return;

                                openDeleteConfirm({
                                  title: `Delete ${selectedStudyAidIds.size} selected study aid${
                                    selectedStudyAidIds.size !== 1 ? "s" : ""
                                  }?`,
                                  message: "This cannot be undone.",
                                  confirmButtonText: "Delete selected",
                                  onConfirm: async () => {
                                    try {
                                      setDeletingSelectedStudyAids(true);
                                      const idsToDelete = Array.from(selectedStudyAidIds);

                                      await Promise.all(
                                        idsToDelete.map((id) => removeLessonStudyQuestion(studyAidLesson.id, id))
                                      );

                                      setStudyAidQuestions((prev) => prev.filter((q) => !selectedStudyAidIds.has(q.id)));
                                      setSelectedStudyAidIds(new Set());

                                      if (editingStudyQuestion && idsToDelete.includes(editingStudyQuestion.id)) {
                                        setEditingStudyQuestion(null);
                                      }

                                      setSuccess(
                                        `${idsToDelete.length} study aid${idsToDelete.length !== 1 ? "s" : ""} deleted.`
                                      );
                                      setTimeout(() => setSuccess(""), 2500);
                                    } catch (e) {
                                      setError((e as Error).message);
                                    } finally {
                                      setDeletingSelectedStudyAids(false);
                                    }
                                  },
                                });
                              }}
                              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingSelectedStudyAids
                                ? "Deleting..."
                                : `Delete Selected${selectedStudyAidIds.size > 0 ? ` (${selectedStudyAidIds.size})` : ""}`}
                            </button>
                          </div>
                        )}

                        {filteredStudyAidQuestions.length === 0 ? (
                          <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                            <p className="text-sm text-gray-500">No questions match your filter.</p>
                          </div>
                        ) : (
                          <>
                            <ul className="space-y-2">
                              {pagedStudyAidQuestions.map((q) => (
                                <li key={q.id} className="p-3 bg-white rounded-xl border border-gray-200">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                      <input
                                        type="checkbox"
                                        checked={selectedStudyAidIds.has(q.id)}
                                        onChange={(e) => {
                                          setSelectedStudyAidIds((prev) => {
                                            const next = new Set(prev);
                                            if (e.target.checked) next.add(q.id);
                                            else next.delete(q.id);
                                            return next;
                                          });
                                        }}
                                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                      />

                                      <span className="inline-flex shrink-0 px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                                        {q.type === "true_false"
                                          ? "Flashcard"
                                          : q.type === "fill_blank"
                                            ? "Fill in the Blank"
                                            : q.type === "multiple_choice"
                                              ? "Multiple Choice"
                                              : "Summary"}
                                      </span>
                                    </div>

                                    
                                    <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setEditingStudyQuestion(q)}
                                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                      title="Edit"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!studyAidLesson) return;

                                        openDeleteConfirm({
                                          title: "Delete this study aid?",
                                          message: "This cannot be undone.",
                                          confirmButtonText: "Delete study aid",
                                          onConfirm: async () => {
                                            try {
                                              await removeLessonStudyQuestion(studyAidLesson.id, q.id);
                                              setStudyAidQuestions((prev) => prev.filter((x) => x.id !== q.id));
                                              setSelectedStudyAidIds((prev) => {
                                                const next = new Set(prev);
                                                next.delete(q.id);
                                                return next;
                                              });
                                              if (editingStudyQuestion?.id === q.id) setEditingStudyQuestion(null);
                                              setSuccess("Study aid deleted.");
                                              setTimeout(() => setSuccess(""), 2500);
                                            } catch (e) {
                                              setError((e as Error).message);
                                            }
                                          },
                                        });
                                      }}
                                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                      title="Remove"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                <span className="text-sm text-gray-800 break-words">{q.question}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-xs text-gray-500">
                                Showing {(studyAidPage - 1) * STUDY_AID_PAGE_SIZE + 1}-
                                {Math.min(studyAidPage * STUDY_AID_PAGE_SIZE, filteredStudyAidQuestions.length)} of {filteredStudyAidQuestions.length}
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setStudyAidPage((p) => Math.max(1, p - 1))}
                                  disabled={studyAidPage === 1}
                                  className="px-2.5 py-1.5 text-xs rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                                >
                                  Prev
                                </button>
                                <span className="text-xs text-gray-600">
                                  Page {studyAidPage} / {studyAidTotalPages}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setStudyAidPage((p) => Math.min(studyAidTotalPages, p + 1))}
                                  disabled={studyAidPage >= studyAidTotalPages}
                                  className="px-2.5 py-1.5 text-xs rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {editingStudyQuestion && studyAidLesson && (
                      <div className="mt-5 rounded-2xl border-2 border-red-200 bg-white p-4 sm:p-5 shadow-sm">
                        <h4 className="font-semibold text-gray-800 mb-4">Edit question</h4>
                        <EditStudyQuestionForm
                          key={editingStudyQuestion.id}
                          question={editingStudyQuestion}
                          onSave={async (updates) => {
                            setStudyAidSaving(true);
                            setError("");
                            try {
                              const updated = await updateLessonStudyQuestion(
                                studyAidLesson.id,
                                editingStudyQuestion.id,
                                updates
                              );
                              setStudyAidQuestions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                              setEditingStudyQuestion(null);
                              setSuccess("Study aid updated.");
                              setTimeout(() => setSuccess(""), 2500);
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
                </section>

                <section className="rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                  <div className="px-4 sm:px-5 py-4 border-b border-gray-200 bg-white">
                    <h3 className="font-semibold text-gray-800">Generate with AI (Gemini)</h3>
                  </div>
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Question type</label>
                        <select
                          value={studyAidGenerateType}
                          onChange={(e) => {
                            setStudyAidGenerateType(e.target.value as any);
                            if (e.target.value === "summary") setStudyAidGenerateCount(1);
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                        >
                          <option value="summary">Summary (1 per lesson)</option>
                          <option value="flashcard">Flashcard</option>
                          <option value="multiple_choice">Multiple choice</option>
                          <option value="fill_blank">Fill in the blank</option>
                        </select>
                      </div>
                      {studyAidGenerateType !== "summary" && (
                        <div className="w-full sm:w-24">
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Count</label>
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
                              if (Number.isFinite(raw) && raw > 0) {
                                setStudyAidGenerateCount(Math.min(10, raw));
                              }
                            }}
                            onBlur={() => {
                              if (studyAidGenerateCount === 0 || studyAidGenerateCount < 1) {
                                setStudyAidGenerateCount(1);
                              }
                            }}
                            className="w-full px-4 py-2.5 border border-gray-300 text-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={
                          studyAidGenerating ||
                          !studyAidLesson ||
                          (studyAidGenerateType === "summary" && hasExistingSummary)
                        }
                        onClick={async () => {
                          if (!studyAidLesson) return;
                          if (studyAidGenerateType === "summary" && hasExistingSummary) return;
                          setStudyAidGenerating(true);
                          setError("");
                          try {
                            const res = await fetch("/api/gemini/generate-questions", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                lessonId: studyAidLesson.id,
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
                            const deduped: any[] = [];
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
                            setSuccess(
                              `${deduped.length} study aid${deduped.length !== 1 ? "s" : ""} generated.`
                            );
                            setTimeout(() => setSuccess(""), 2500);
                          } catch (e) {
                            setError((e as Error).message);
                            setGeneratedForStudy([]);
                          } finally {
                            setStudyAidGenerating(false);
                          }
                        }}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white text-sm font-semibold rounded-xl hover:from-rose-700 hover:to-red-700 disabled:opacity-50 ${
                          studyAidGenerateType === "summary" ? "sm:col-span-2 sm:justify-self-center" : ""
                        }`}
                      >
                        {studyAidGenerating ? "Generating..." : "Generate"}
                      </button>
                      {studyAidGenerateType === "summary" && hasExistingSummary && (
                        <p className="sm:col-span-2 text-center text-sm text-amber-700 font-medium">
                          Only one summary is allowed per lesson. Remove the existing summary first to generate another.
                        </p>
                      )}
                    </div>

                    {generatedForStudy.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                          {generatedForStudy.map((q: any, idx: number) => (
                            <li
                              key={idx}
                              className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${selectedGenerated.has(idx) ? "bg-red-50/80" : "hover:bg-gray-50"}`}
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
                              <span className="text-sm text-gray-800 flex-1 break-words">{q.question}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                          <button
                            type="button"
                            disabled={
                              studyAidAdding ||
                              selectedGenerated.size === 0 ||
                              !studyAidLesson ||
                              (studyAidGenerateType === "summary" && hasExistingSummary)
                            }
                            onClick={async () => {
                              if (!studyAidLesson) return;
                              if (studyAidGenerateType === "summary" && hasExistingSummary) return;
                              const toAdd = generatedForStudy.filter((_: any, i: number) => selectedGenerated.has(i));
                              if (!toAdd.length) return;
                              setStudyAidAdding(true);
                              try {
                                const payload = toAdd.map((q: any) => ({
                                  type: studyAidGenerateType === "summary" ? "summary" : q.type,
                                  question: q.question,
                                  options: q.options,
                                  fill_blank_answer_mode: q.fill_blank_answer_mode ?? "term_only",
                                  correct_answer: q.correct_answer,
                                }));
                                const result = await addLessonStudyQuestions(studyAidLesson.id, payload as any);
                                const list = await getLessonStudyQuestions(studyAidLesson.id);
                                setStudyAidQuestions(list);
                                setGeneratedForStudy([]);
                                setSelectedGenerated(new Set());
                                setSelectedStudyAidIds(new Set());
                                const duplicateNote =
                                  result.skippedDuplicates > 0
                                    ? ` (${result.skippedDuplicates} duplicate${result.skippedDuplicates !== 1 ? "s" : ""} skipped)`
                                    : "";
                                setSuccess(
                                  `${result.added} study aid${result.added !== 1 ? "s" : ""} added${duplicateNote}.`
                                );
                                setTimeout(() => setSuccess(""), 2500);
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setStudyAidAdding(false);
                              }
                            }}
                            className="w-full px-4 py-3 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50"
                          >
                            {studyAidAdding ? "Adding..." : `Add ${selectedGenerated.size} to study aid`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm"
          onClick={closeDeleteConfirm}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/90">
              <div className="text-lg font-semibold text-slate-900">{deleteConfirm.title}</div>
              <p className="mt-2 text-sm text-slate-600">{deleteConfirm.message}</p>
            </div>

            <div className="flex flex-col gap-2 p-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="w-full sm:flex-1 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmingDelete}
                onClick={async () => {
                  if (!deleteConfirm) return;
                  setConfirmingDelete(true);
                  try {
                    await deleteConfirm.onConfirm();
                    closeDeleteConfirm();
                  } finally {
                    setConfirmingDelete(false);
                  }
                }}
                className="w-full sm:flex-1 rounded-2xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
              >
                {confirmingDelete ? "Deleting…" : deleteConfirm.confirmButtonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
