"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import CourseNavbar from "@/utils/CourseNavbar";
import { getCourseById, getCurrentProfessorId } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { getQuizzes, getQuestions, createQuestion, updateQuestion, deleteQuestion, createQuiz, updateQuiz, setQuizQuestions, deleteQuiz } from "@/lib/supabase/queries/quizzes";
import { getLessons } from "@/lib/supabase/queries/lessons";
import type { Question as DBQuestion } from "@/lib/supabase/queries/quizzes";
import type { Lesson } from "@/lib/supabase/queries/lessons";
import QuizMonitoringModal from "@/components/quiz/QuizMonitoringModal";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function manilaInputToUtcIso(input: string): string | null {
  if (!input) return null;
  const [datePart, timePart] = input.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map((x) => parseInt(x, 10));
  const [hour, minute] = timePart.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  // Treat the input as Asia/Manila local time (UTC+8, no DST)
  const manilaMs = Date.UTC(year, month - 1, day, hour, minute);
  const utcMs = manilaMs - MANILA_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

function utcIsoToManilaInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const manilaMs = d.getTime() + MANILA_OFFSET_MS;
  const manila = new Date(manilaMs);
  const yyyy = manila.getUTCFullYear();
  const mm = String(manila.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(manila.getUTCDate()).padStart(2, "0");
  const hh = String(manila.getUTCHours()).padStart(2, "0");
  const mi = String(manila.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// Quiz question interfaces for UI
interface Question {
  id: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
  question: string;
  options?: string[];
  correctAnswer: number | boolean | string;
  source?: string;
  sourceType?: "lesson" | "pdf";
  createdAt: string;
}

// Question type definition
type QuestionType = "multiple_choice" | "true_false" | "fill_blank";

// Quiz question interfaces for UI

export default function QuizzesPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [createQuizModalOpen, setCreateQuizModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatingForSourceId, setGeneratingForSourceId] = useState<string | null>(null);
  const [createQuestionModalOpen, setCreateQuestionModalOpen] = useState(false);
  const [editingBankQuestion, setEditingBankQuestion] = useState<Question | null>(null);
  const [monitoringQuizId, setMonitoringQuizId] = useState<string | null>(null);
  const [monitoringQuizName, setMonitoringQuizName] = useState<string>("");

  // Form state
  const [quizName, setQuizName] = useState("");
  const [quizType, setQuizType] = useState<"mixed" | "multiple_choice" | "true_false" | "fill_blank">("mixed");
  const [quizDueDate, setQuizDueDate] = useState("");
  const [quizMaxAttempts, setQuizMaxAttempts] = useState<string>("1");
  const [quizPointsPerQuestion, setQuizPointsPerQuestion] = useState<string>("10");
  const [quizRevealCorrectAnswers, setQuizRevealCorrectAnswers] = useState<boolean>(false);
  const [generateQuestionType, setGenerateQuestionType] = useState<"multiple_choice" | "true_false" | "fill_blank">("multiple_choice");
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [quizBank, setQuizBank] = useState<Question[]>([]);
  const [filteredBank, setFilteredBank] = useState<Question[]>([]);
  const [bankQuestionFilter, setBankQuestionFilter] = useState<"all" | QuestionType>("all");
  const [bankSourceFilter, setBankSourceFilter] = useState<"all" | "manual" | string>("all");
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [mobileQuestionBankOpen, setMobileQuestionBankOpen] = useState(false);

  // Create question form
  const [newQuestion, setNewQuestion] = useState({
    type: "multiple_choice" as QuestionType,
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    trueFalseAnswer: true,
    fillBlankAnswer: "",
    source: "",
    sourceType: "lesson" as "lesson" | "pdf",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Retake management state (now shown inside the Edit Quiz modal)
  const [retakeRows, setRetakeRows] = useState<any[]>([]);
  const [retakeLoading, setRetakeLoading] = useState(false);
  const { handledCourses } = useProfessorCourses();

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        
        // Fetch quizzes, questions, and lessons
        const [quizzesData, questionsData, lessonsData] = await Promise.all([
          getQuizzes(courseId),
          // Exclude study-aid-only questions so the quiz bank stays assessment-focused.
          getQuestions(courseId, undefined, { includeStudyAid: false }),
          getLessons(courseId),
        ]);
        
        setQuizzes(quizzesData);
        setLessons(lessonsData);
        
        // Transform questions to match UI format
        const transformedQuestions = questionsData.map((q) => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          correctAnswer: q.correct_answer,
          source: q.source_lesson_id,
          sourceType: q.source_type,
          createdAt: q.created_at,
        }));
        
        setQuizBank(transformedQuestions);
        setFilteredBank(transformedQuestions);
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

  // Filter quiz bank by type
  useEffect(() => {
    if (quizType === "mixed") {
      setFilteredBank(quizBank);
    } else {
      setFilteredBank(quizBank.filter((q) => q.type === quizType));
    }
  }, [quizType, quizBank]);

  const sourceFilterOptions = useMemo(() => {
    const lessonNameById = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
    const lessonMetaById = new Map(
      lessons.map((lesson) => [lesson.id, { category: lesson.category, order: lesson.order, title: lesson.title }])
    );
    const categoryRank: Record<string, number> = { prelim: 0, midterm: 1, finals: 2 };
    const lessonIdsInBank = Array.from(
      new Set(quizBank.map((q) => q.source).filter((sourceId): sourceId is string => Boolean(sourceId)))
    );

    return lessonIdsInBank
      .map((lessonId) => ({
        id: lessonId,
        name: lessonNameById.get(lessonId) || "Unknown lesson",
      }))
      .sort((a, b) => {
        const aMeta = lessonMetaById.get(a.id);
        const bMeta = lessonMetaById.get(b.id);
        const byCategory = (categoryRank[aMeta?.category || ""] ?? 999) - (categoryRank[bMeta?.category || ""] ?? 999);
        if (byCategory !== 0) return byCategory;
        const byOrder = (aMeta?.order ?? 999999) - (bMeta?.order ?? 999999);
        if (byOrder !== 0) return byOrder;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });
  }, [quizBank, lessons]);

  const displayedBank = useMemo(() => {
    const typePriority: Record<QuestionType, number> = {
      multiple_choice: 0,
      true_false: 1,
      fill_blank: 2,
    };

    const filtered =
      bankQuestionFilter === "all"
        ? filteredBank
        : filteredBank.filter((q) => q.type === bankQuestionFilter);

    const sourceFiltered =
      bankSourceFilter === "all"
        ? filtered
        : bankSourceFilter === "manual"
          ? filtered.filter((q) => !q.source)
          : filtered.filter((q) => q.source === bankSourceFilter);

    return [...sourceFiltered].sort((a, b) => {
      const byType = typePriority[a.type] - typePriority[b.type];
      if (byType !== 0) return byType;

      const byQuestion = a.question.localeCompare(b.question, undefined, { sensitivity: "base" });
      if (byQuestion !== 0) return byQuestion;

      return a.id.localeCompare(b.id);
    });
  }, [filteredBank, bankQuestionFilter, bankSourceFilter]);

  const handleQuestionSelect = (question: Question) => {
    if (!selectedQuestions.find((q) => q.id === question.id)) {
      setSelectedQuestions([...selectedQuestions, question]);
    }
  };

  const handleQuestionRemove = (questionId: string) => {
    setSelectedQuestions(selectedQuestions.filter((q) => q.id !== questionId));
  };

  const handleGenerateQuiz = () => {
    setGenerateModalOpen(true);
  };

  const handleGenerateFromSource = async (sourceId: string, sourceType: "lesson" | "pdf") => {
    setGeneratingQuestions(true);
    setGeneratingForSourceId(sourceId);
    setError("");
    try {
      const response = await fetch("/api/gemini/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: sourceId,
          questionType: generateQuestionType,
          count: 5,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }

      const { questions: generatedQuestions } = await response.json();

      // Get professor ID
      const professorId = await getCurrentProfessorId(true);
      if (!professorId) {
        throw new Error("Professor not found");
      }

      // Save generated questions to database
      const savedQuestions = await Promise.all(
        generatedQuestions.map((q: any) =>
          createQuestion({
            course_id: courseId,
            professor_id: professorId,
            type: q.type,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            source_lesson_id: q.source_lesson_id,
            source_type: q.source_type,
          })
        )
      );

      // Transform and add to quiz bank
      const transformedQuestions = savedQuestions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correct_answer,
        source: q.source_lesson_id,
        sourceType: q.source_type,
        createdAt: q.created_at,
      }));

      setQuizBank([...quizBank, ...transformedQuestions]);
      setFilteredBank([...filteredBank, ...transformedQuestions]);
      setGenerateModalOpen(false);
      setSuccess(`Generated ${transformedQuestions.length} questions!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Error generating questions:", err);
      setError(err.message || "Failed to generate questions");
    } finally {
      setGeneratingQuestions(false);
      setGeneratingForSourceId(null);
    }
  };

  const handleCreateQuestion = async () => {
    setError("");
    setSuccess("");

    if (!newQuestion.question.trim()) {
      setError("Please enter a question.");
      return;
    }

    if (newQuestion.type === "multiple_choice") {
      if (newQuestion.options.some((opt) => !opt.trim())) {
        setError("Please fill all option fields.");
        return;
      }
    }

    try {
      const professorId = await getCurrentProfessorId(true);
      if (!professorId) {
        throw new Error("Professor not found");
      }

      const question =
        editingBankQuestion
          ? await updateQuestion(editingBankQuestion.id, {
              type: newQuestion.type,
              question: newQuestion.question.trim(),
              options: newQuestion.type === "multiple_choice" ? newQuestion.options : null,
              correct_answer:
                newQuestion.type === "multiple_choice"
                  ? newQuestion.correctAnswer
                  : newQuestion.type === "true_false"
                    ? newQuestion.trueFalseAnswer
                    : newQuestion.fillBlankAnswer,
              source_lesson_id: newQuestion.source || null,
              source_type: newQuestion.source ? newQuestion.sourceType : null,
            })
          : await createQuestion({
              course_id: courseId,
              professor_id: professorId,
              type: newQuestion.type,
              question: newQuestion.question.trim(),
              options: newQuestion.type === "multiple_choice" ? newQuestion.options : undefined,
              correct_answer:
                newQuestion.type === "multiple_choice"
                  ? newQuestion.correctAnswer
                  : newQuestion.type === "true_false"
                    ? newQuestion.trueFalseAnswer
                    : newQuestion.fillBlankAnswer,
              source_lesson_id: newQuestion.source || undefined,
              source_type: newQuestion.sourceType,
            });

      // Transform and add to quiz bank
      const transformedQuestion = {
        id: question.id,
        type: question.type,
        question: question.question,
        options: question.options,
        correctAnswer: question.correct_answer,
        source: question.source_lesson_id,
        sourceType: question.source_type,
        createdAt: question.created_at,
      };

      if (editingBankQuestion) {
        setQuizBank((prev) => prev.map((q) => (q.id === transformedQuestion.id ? transformedQuestion : q)));
        setFilteredBank((prev) => prev.map((q) => (q.id === transformedQuestion.id ? transformedQuestion : q)));
        setSelectedQuestions((prev) => prev.map((q) => (q.id === transformedQuestion.id ? transformedQuestion : q)));
      } else {
        setQuizBank([...quizBank, transformedQuestion]);
        setFilteredBank([...filteredBank, transformedQuestion]);
        setSelectedQuestions([...selectedQuestions, transformedQuestion]);
      }
      setCreateQuestionModalOpen(false);
      setSuccess(editingBankQuestion ? "Question updated." : "Question created and added to quiz!");
      setTimeout(() => setSuccess(""), 3000);
      setEditingBankQuestion(null);

      // Reset form
      setNewQuestion({
        type: "multiple_choice",
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        trueFalseAnswer: true,
        fillBlankAnswer: "",
        source: "",
        sourceType: "lesson",
      });
    } catch (err: any) {
      console.error("Error creating question:", err);
      setError(err.message || "Failed to create question");
    }
  };

  const handleCreateQuiz = async () => {
    setError("");
    setSuccess("");

    if (!quizName.trim()) {
      setError("Please enter a quiz name.");
      return;
    }

    if (selectedQuestions.length === 0) {
      setError("Please select at least one question for the quiz.");
      return;
    }

    const questionIds = selectedQuestions.map((q) => q.id).filter((id) => id && id.trim() !== "");
    if (questionIds.length === 0) {
      setError("No valid question IDs found. Please select questions again.");
      return;
    }

    try {
      if (editingQuiz) {
        await updateQuiz(editingQuiz.id, {
          name: quizName.trim(),
          type: quizType,
          due_date: quizDueDate.trim() ? manilaInputToUtcIso(quizDueDate.trim()) : null,
          max_attempts: quizMaxAttempts.trim() ? Number(quizMaxAttempts) : null,
          points_per_question: quizPointsPerQuestion.trim()
            ? Number(quizPointsPerQuestion)
            : 10,
          reveal_correct_answers: quizRevealCorrectAnswers,
        });
        await setQuizQuestions(editingQuiz.id, questionIds);
        const updatedQuizzes = await getQuizzes(courseId);
        setQuizzes(updatedQuizzes);
        setSuccess("Quiz updated successfully!");
        setEditingQuiz(null);
        setQuizName("");
        setQuizType("mixed");
        setQuizDueDate("");
        setQuizMaxAttempts("1");
        setSelectedQuestions([]);
        setTimeout(() => {
          setCreateQuizModalOpen(false);
          setSuccess("");
        }, 1000);
        return;
      }

      const quiz = await createQuiz(
        courseId,
        {
          name: quizName.trim(),
          type: quizType,
          due_date: quizDueDate.trim() ? manilaInputToUtcIso(quizDueDate.trim()) ?? undefined : undefined,
          max_attempts: quizMaxAttempts.trim() ? Number(quizMaxAttempts) : null,
          points_per_question: quizPointsPerQuestion.trim()
            ? Number(quizPointsPerQuestion)
            : 10,
          reveal_correct_answers: quizRevealCorrectAnswers,
        },
        questionIds
      );

      const updatedQuizzes = await getQuizzes(courseId);
      setQuizzes(updatedQuizzes);
      setSuccess("Quiz created successfully!");

      setQuizName("");
      setQuizType("mixed");
      setQuizDueDate("");
      setQuizMaxAttempts("1");
      setSelectedQuestions([]);

      setTimeout(() => {
        setCreateQuizModalOpen(false);
        setSuccess("");
      }, 1000);
    } catch (err: any) {
      console.error("Error creating quiz:", {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        fullError: err,
      });
      const errorMessage = err?.message || err?.details || err?.hint || "Failed to create quiz. Please check that all selected questions are valid.";
      setError(errorMessage);
    }
  };

  const handleCancel = () => {
    setCreateQuizModalOpen(false);
    setEditingQuiz(null);
    setGenerateModalOpen(false);
    setCreateQuestionModalOpen(false);
    setEditingBankQuestion(null);
    setQuizName("");
    setQuizType("mixed");
    setQuizDueDate("");
    setQuizMaxAttempts("1");
    setQuizPointsPerQuestion("10");
    setQuizRevealCorrectAnswers(false);
    setSelectedQuestions([]);
    setRetakeRows([]);
    setRetakeLoading(false);
    setError("");
    setSuccess("");
    setMobileQuestionBankOpen(false);
  };

  const renderQuizAdvancedOptions = () => (
    <>
      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 max-lg:p-3">
        <input
          id="quizRevealCorrectAnswers"
          type="checkbox"
          checked={quizRevealCorrectAnswers}
          onChange={(e) => setQuizRevealCorrectAnswers(e.target.checked)}
          className="mt-1 h-4 w-4 accent-indigo-600"
        />
        <div className="flex-1 min-w-0">
          <label htmlFor="quizRevealCorrectAnswers" className="block text-sm font-semibold text-gray-800">
            Show correct answers in student results
          </label>
          <p className="text-xs text-gray-600 mt-1">
            If unchecked, students will still see whether they were correct, but not the correct answer.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="quizDueDate" className="block text-sm font-semibold text-gray-700 mb-2">
          Lock date &amp; time <span className="text-gray-500 text-xs">(Optional)</span>
        </label>
        <input
          id="quizDueDate"
          type="datetime-local"
          value={quizDueDate}
          onChange={(e) => setQuizDueDate(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white max-lg:min-h-10 max-lg:py-2.5 max-lg:text-base"
        />
        <p className="mt-1 text-xs text-gray-500">
          After this time, students will no longer be able to start this quiz.
        </p>
      </div>

      <div>
        <label htmlFor="quizMaxAttempts" className="block text-sm font-semibold text-gray-700 mb-2">
          Max takes per student <span className="text-gray-500 text-xs">(Optional)</span>
        </label>
        <input
          id="quizMaxAttempts"
          type="number"
          min={1}
          value={quizMaxAttempts}
          onChange={(e) => setQuizMaxAttempts(e.target.value)}
          placeholder="1"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white max-lg:min-h-10 max-lg:py-2.5 max-lg:text-base"
        />
        <p className="text-xs text-gray-500 mt-1">Set to blank for unlimited attempts.</p>
      </div>
    </>
  );

  const renderQuestionBankPanel = () => (
    <>
      <div className="shrink-0 border-b border-gray-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:px-4 lg:p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold tracking-tight text-gray-900 lg:text-lg">Question bank</h3>
            <p className="mt-0.5">
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                {displayedBank.length} match{displayedBank.length !== 1 ? "es" : ""}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingBankQuestion(null);
              setNewQuestion({
                type: "multiple_choice",
                question: "",
                options: ["", "", "", ""],
                correctAnswer: 0,
                trueFalseAnswer: true,
                fillBlankAnswer: "",
                source: "",
                sourceType: "lesson",
              });
              setCreateQuestionModalOpen(true);
            }}
            className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
          >
            + Create
          </button>
        </div>

        <div className="mt-2 flex flex-col gap-2 lg:mt-3 lg:gap-2">
          <button
            type="button"
            onClick={handleGenerateQuiz}
            className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md active:scale-[0.99] lg:min-h-0 lg:py-2.5 lg:text-sm lg:hover:-translate-y-0.5"
          >
            <svg className="h-4 w-4 shrink-0 lg:h-5 lg:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <span className="truncate">Generate more</span>
          </button>

          <details className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm open:shadow-md open:ring-1 open:ring-rose-100/80">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 [&::-webkit-details-marker]:hidden lg:py-2.5 lg:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                Filters
              </span>
              <svg
                className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="space-y-2.5 border-t border-gray-100 bg-gray-50/90 p-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Question type
                </label>
                <select
                  value={bankQuestionFilter}
                  onChange={(e) => setBankQuestionFilter(e.target.value as "all" | QuestionType)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                >
                  <option value="all">All types</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True or False</option>
                  <option value="fill_blank">Fill in the Blank</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Source
                </label>
                <select
                  value={bankSourceFilter}
                  onChange={(e) => setBankSourceFilter(e.target.value)}
                  className="w-full min-w-0 max-w-full truncate rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                >
                  <option value="all">All sources</option>
                  <option value="manual">Created manually (no lesson)</option>
                  {sourceFilterOptions.map((sourceOpt) => (
                    <option key={sourceOpt.id} value={sourceOpt.id}>
                      Lesson: {sourceOpt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-1.5 sm:px-3 lg:p-4 lg:pt-2">
        <div className="mb-1.5 shrink-0 px-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Browse</span>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain rounded-xl border border-gray-200/90 bg-white/95 p-2 shadow-inner [-webkit-overflow-scrolling:touch] [scrollbar-color:rgba(0,0,0,0.2)_transparent] [scrollbar-width:thin] lg:max-h-[min(calc(90vh-14rem),32rem)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
          {displayedBank.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p>No questions in quiz bank for this type.</p>
              <button
                type="button"
                onClick={() => {
                  setEditingBankQuestion(null);
                  setNewQuestion({
                    type: "multiple_choice",
                    question: "",
                    options: ["", "", "", ""],
                    correctAnswer: 0,
                    trueFalseAnswer: true,
                    fillBlankAnswer: "",
                    source: "",
                    sourceType: "lesson",
                  });
                  setCreateQuestionModalOpen(true);
                }}
                className="mt-4 text-sm font-medium text-red-600 hover:text-red-700"
              >
                Create one now
              </button>
            </div>
          ) : (
            displayedBank.map((question) => {
              const isSelected = selectedQuestions.some((q) => q.id === question.id);
              return (
                <div
                  key={question.id}
                  className={`cursor-pointer rounded-xl border p-3 transition-all sm:p-3.5 ${
                    isSelected
                      ? "border-red-300 bg-red-100"
                      : "border-gray-200 bg-white hover:border-red-300 hover:shadow-md"
                  }`}
                  onClick={() => !isSelected && handleQuestionSelect(question)}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                      {question.type.replace("_", " ")}
                    </span>
                    {isSelected && (
                      <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                        Selected
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (deletingQuestionId) return;
                        if (!confirm("Delete this question? This cannot be undone.")) return;
                        try {
                          setDeletingQuestionId(question.id);
                          await deleteQuestion(question.id);
                          setQuizBank((prev) => prev.filter((q) => q.id !== question.id));
                          setFilteredBank((prev) => prev.filter((q) => q.id !== question.id));
                          setSelectedQuestions((prev) => prev.filter((q) => q.id !== question.id));
                          setSuccess("Question deleted.");
                          setTimeout(() => setSuccess(""), 2500);
                        } catch (err: any) {
                          console.error("Error deleting question:", err);
                          setError(err?.message || "Failed to delete question.");
                        } finally {
                          setDeletingQuestionId(null);
                        }
                      }}
                      className="ml-auto rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Delete question"
                      disabled={deletingQuestionId === question.id}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (deletingQuestionId === question.id) return;
                        setEditingBankQuestion(question);
                        setNewQuestion({
                          type: question.type as QuestionType,
                          question: question.question,
                          options:
                            question.type === "multiple_choice"
                              ? (question.options?.length ? question.options : ["", "", "", ""])
                              : ["", "", "", ""],
                          correctAnswer:
                            question.type === "multiple_choice"
                              ? (typeof question.correctAnswer === "number"
                                  ? question.correctAnswer
                                  : Number(question.correctAnswer) || 0)
                              : 0,
                          trueFalseAnswer:
                            question.type === "true_false" ? Boolean(question.correctAnswer) : true,
                          fillBlankAnswer:
                            question.type === "fill_blank" ? String(question.correctAnswer ?? "") : "",
                          source: question.source || "",
                          sourceType: question.sourceType || "lesson",
                        });
                        setCreateQuestionModalOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Edit question"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="mb-2 break-words whitespace-normal text-sm font-medium text-gray-800">{question.question}</p>
                  {question.type === "multiple_choice" && question.options && (
                    <div className="mt-2 space-y-1">
                      {question.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 min-w-0">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-xs text-white">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className={`min-w-0 line-clamp-4 ${idx === question.correctAnswer ? "font-semibold text-green-600" : ""}`}>
                            {opt}
                          </span>
                          {idx === question.correctAnswer && (
                            <svg className="h-3 w-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {question.type === "true_false" && (
                    <p className="mt-2 text-xs text-gray-600">
                      Correct Answer: <span className="font-semibold">{question.correctAnswer ? "True" : "False"}</span>
                    </p>
                  )}
                  {question.type === "fill_blank" && (
                    <p className="mt-2 text-xs text-gray-600">
                      Answer: <span className="font-semibold">{question.correctAnswer as string}</span>
                    </p>
                  )}
                  {question.source && (
                    <p className="mt-2 text-xs text-gray-500">
                      From: {question.sourceType === "lesson" ? "Lesson" : "PDF"}
                    </p>
                  )}
                  {!isSelected && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuestionSelect(question);
                      }}
                      className="mt-3 w-full rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-700"
                    >
                      Add to Quiz
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />
        <CourseNavbar courseId={courseId} currentPage="quizzes" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalQuizzes = quizzes.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      {/* Professor Navbar */}
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />

      {/* Course Navbar */}
      <CourseNavbar
        courseId={courseId}
        currentPage="quizzes"
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
                Quizzes
              </h1>
              <p className="text-sm sm:text-base text-gray-600 truncate" 
              title={course.name}
              >
                {course?.name} ({course?.code}) • {totalQuizzes} quiz{totalQuizzes !== 1 ? "zes" : ""}
              </p>
            </div>
            <button
              onClick={() => {
                setEditingQuiz(null);
                setQuizName("");
                setQuizType("mixed");
                setQuizDueDate("");
                setQuizMaxAttempts("1");
                setQuizPointsPerQuestion("10");
                setQuizRevealCorrectAnswers(false);
                setSelectedQuestions([]);
                setCreateQuizModalOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Quiz
            </button>
          </div>
        </div>

        {/* Quizzes List */}
        {totalQuizzes === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-rose-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No quizzes yet</h3>
              <p className="text-gray-600">Use the "Create Quiz" button above to get started</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 truncate"
                    title={quiz.name}
                    >
                      {quiz.name}</h3>
                    <p className="text-gray-600 text-sm">
                      Type: {quiz.type.replace("_", " ")} • {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setMonitoringQuizId(quiz.id);
                        setMonitoringQuizName(quiz.name);
                      }}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="View attempts & logs"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={async () => {
                        // Open edit modal with quiz details
                        setEditingQuiz(quiz);
                        setQuizName(quiz.name);
                        setQuizType(quiz.type ?? "mixed");
                        setQuizDueDate(quiz.due_date ? utcIsoToManilaInput(quiz.due_date) : "");
                        setQuizMaxAttempts(quiz.max_attempts != null ? String(quiz.max_attempts) : "");
                        setQuizPointsPerQuestion(
                          (quiz as any).points_per_question != null
                            ? String((quiz as any).points_per_question)
                            : "10"
                        );
                        setQuizRevealCorrectAnswers(Boolean((quiz as any).reveal_correct_answers));
                        setSelectedQuestions(
                          quiz.questions?.map((q: any) => ({
                            id: q.id,
                            type: q.type,
                            question: q.question,
                            options: q.options,
                            correctAnswer: q.correct_answer,
                            source: q.source_lesson_id,
                            sourceType: q.source_type,
                            createdAt: q.created_at,
                          })) ?? []
                        );
                        setCreateQuizModalOpen(true);

                        // Load retake rows for this quiz to manage inside the edit modal
                        setRetakeLoading(true);
                        setRetakeRows([]);
                        try {
                          const res = await fetch("/api/quizzes/retakes/list", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ quizId: quiz.id }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            throw new Error(data?.error || "Failed to load retakes");
                          }
                          setRetakeRows(Array.isArray(data?.rows) ? data.rows : []);
                        } catch (e: any) {
                          console.error("Error loading retakes:", e);
                          setError(e.message || "Failed to load retakes");
                        } finally {
                          setRetakeLoading(false);
                        }
                      }}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Edit quiz"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete quiz "${quiz.name}"? This will also remove its attempts and answers.`)) {
                          return;
                        }
                        try {
                          await deleteQuiz(quiz.id);
                          setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
                          setSuccess("Quiz deleted.");
                          setTimeout(() => setSuccess(""), 3000);
                        } catch (err: any) {
                          console.error("Error deleting quiz:", err);
                          setError(err?.message || "Failed to delete quiz.");
                        }
                      }}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete quiz"
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
        )}

      {/* Create / Edit Quiz Modal (also includes Manage Retakes when editing) */}
      {createQuizModalOpen && (
        <>
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
          onClick={handleCancel}
        >
          <div
            className="bg-white flex flex-col w-full max-w-full h-auto max-h-[80dvh] overflow-hidden rounded-2xl shadow-2xl mt-20 sm:mt-24 lg:mt-0 lg:max-h-[90vh] lg:max-w-7xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header — desktop matches original card header */}
            <div className="flex items-start sm:items-center justify-between gap-3 border-b border-gray-200 p-3 sm:p-6 max-lg:pt-[max(0.5rem,env(safe-area-inset-top))] max-lg:pb-3">
              <h2 className="text-lg font-bold text-gray-900 break-words sm:text-xl lg:text-2xl">
                {editingQuiz ? "Edit Quiz" : "Create Quiz"}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer max-lg:flex max-lg:h-11 max-lg:w-11 max-lg:shrink-0 max-lg:items-center max-lg:justify-center max-lg:rounded-lg max-lg:hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              {/* Main: full scroll on mobile (bank opens in its own overlay); sidebar unchanged on lg */}
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6 pb-6 sm:pb-6 max-lg:flex-1 max-lg:min-h-0 max-lg:overscroll-y-contain max-lg:[-webkit-overflow-scrolling:touch] lg:max-h-none">
                {/* Quiz Name and Type */}
                <div className="mb-4 space-y-3 max-lg:space-y-2.5 lg:mb-6 lg:space-y-4">
                  <div>
                    <label htmlFor="quizName" className="block text-sm font-semibold text-gray-700 mb-2">
                      Quiz Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="quizName"
                      type="text"
                      value={quizName}
                      onChange={(e) => setQuizName(e.target.value)}
                      placeholder="Enter quiz name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white max-lg:min-h-11 max-lg:text-base"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label htmlFor="quizType" className="block text-sm font-semibold text-gray-700 mb-2">
                      Quiz Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="quizType"
                      value={quizType}
                      onChange={(e) => setQuizType(e.target.value as QuestionType)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white appearance-none cursor-pointer max-lg:min-h-11 max-lg:text-base"
                    >
                      <option value="mixed">Mixed (Any Type)</option>
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="true_false">True or False</option>
                      <option value="fill_blank">Fill in the Blank</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quizPointsPerQuestion" className="block text-sm font-semibold text-gray-700 mb-2">
                      Points per question <span className="text-gray-500 text-xs">(Required)</span>
                    </label>
                    <input
                      id="quizPointsPerQuestion"
                      type="number"
                      min={1}
                      value={quizPointsPerQuestion}
                      onChange={(e) => setQuizPointsPerQuestion(e.target.value)}
                      placeholder="10"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-700 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white max-lg:min-h-11 max-lg:text-base"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Used to compute total quiz score (points × number of items).
                    </p>
                  </div>

                  <div className="hidden space-y-4 lg:block">{renderQuizAdvancedOptions()}</div>

                  <details className="group rounded-xl border border-gray-200 bg-gray-50/60 open:bg-gray-50/80 lg:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-gray-800 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold">More settings</span>
                        <span className="mt-0.5 block text-xs font-normal text-gray-500">
                          Due date, attempts, reveal answers
                        </span>
                      </div>
                      <svg
                        className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="space-y-3 border-t border-gray-200/80 px-3 pb-3 pt-3">{renderQuizAdvancedOptions()}</div>
                  </details>
                </div>

                {/* Selected Questions Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4 gap-2 min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 truncate">
                      Selected Questions ({selectedQuestions.length})
                    </h3>
                    {selectedQuestions.length > 0 && (
                      <button
                        onClick={() => setSelectedQuestions([])}
                        className="shrink-0 text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {selectedQuestions.length === 0 ? (
                    <div className="bg-gray-50 rounded-xl p-8 text-center">
                      <p className="text-gray-500">No questions selected yet. Choose questions from the quiz bank.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto max-lg:max-h-[32vh] max-lg:overscroll-y-contain max-lg:[-webkit-overflow-scrolling:touch]">
                      {selectedQuestions.map((question, index) => (
                        <div
                          key={question.id}
                          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between max-lg:flex-col max-lg:gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded">
                                {index + 1}
                              </span>
                              <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded">
                                {question.type.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-gray-800 font-medium break-words">{question.question}</p>
                            {question.source && (
                              <p className="text-xs text-gray-500 mt-1">
                                From: {question.sourceType === "lesson" ? "Lesson" : "PDF"}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuestionRemove(question.id)}
                            className="ml-4 shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors max-lg:ml-0 max-lg:self-end max-lg:flex max-lg:h-11 max-lg:w-11 max-lg:items-center max-lg:justify-center"
                            aria-label="Remove question"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-6 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileQuestionBankOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm transition hover:border-rose-300 hover:shadow"
                  >
                    <svg className="h-5 w-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    Open question bank
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                      {displayedBank.length}
                    </span>
                  </button>
                </div>

                {/* Manage Retakes (only for editing an existing quiz) */}
                {editingQuiz && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-800">Manage Retakes</h3>
                      {retakeLoading && (
                        <span className="text-xs text-gray-500">Loading retakes…</span>
                      )}
                    </div>
                    {retakeLoading ? (
                      <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-500">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent" />
                          <span>Loading retake data…</span>
                        </div>
                      </div>
                    ) : retakeRows.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
                        No students found for retake management.
                      </div>
                    ) : ( 
                      <div className="max-h-[32vh] overflow-y-auto overscroll-y-contain rounded-xl border border-gray-200 bg-gray-50/40 p-2 max-lg:max-h-[28vh] max-lg:[-webkit-overflow-scrolling:touch]">
                        {retakeRows.map((r) => (
                          <div
                            key={r.studentDbId}
                            className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 flex items-start justify-between gap-3 min-w-0"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-800 truncate max-lg:break-words max-lg:whitespace-normal">{r.name}</p>
                              <p className="text-xs text-gray-600 truncate max-lg:break-all max-lg:whitespace-normal">{r.email}</p>
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                Attempts used: {r.attemptsUsed} • Extra retakes: {r.extraAttempts} •{" "}
                                {r.allowedAttempts == null
                                  ? "Allowed: unlimited"
                                  : `Allowed: ${r.allowedAttempts}`} •{" "}
                                {r.remainingAttempts == null
                                  ? "Remaining: unlimited"
                                  : `Remaining: ${r.remainingAttempts}`}
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch("/api/quizzes/retakes/grant", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      quizId: editingQuiz.id,
                                      studentId: r.studentDbId,
                                      incrementBy: 1,
                                    }),
                                  });
                                  const data = await res.json().catch(() => ({}));
                                  if (!res.ok) {
                                    throw new Error(data?.error || "Failed to grant retake");
                                  }
                                  setRetakeRows((prev) =>
                                    prev.map((x) =>
                                      x.studentDbId === r.studentDbId
                                        ? {
                                            ...x,
                                            extraAttempts: data.extra_attempts,
                                            allowedAttempts:
                                              x.maxAttempts == null
                                                ? null
                                                : x.maxAttempts + data.extra_attempts,
                                            remainingAttempts:
                                              x.maxAttempts == null
                                                ? null
                                                : Math.max(
                                                    (x.maxAttempts + data.extra_attempts) - x.attemptsUsed,
                                                    0
                                                  ),
                                          }
                                        : x
                                    )
                                  );
                                } catch (e: any) {
                                  console.error("Error granting retake:", e);
                                  setError(e.message || "Failed to grant retake");
                                }
                              }}
                              className="shrink-0 self-start px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 sm:text-sm"
                            >
                              Grant retake
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {success}
                  </div>
                )}
              </div>

              {/* Quiz bank sidebar (desktop only; mobile uses full-screen overlay) */}
              <div className="hidden min-h-0 w-full flex-col overflow-hidden border-t border-gray-200/90 bg-gradient-to-b from-rose-50/40 via-gray-50/90 to-gray-100/70 lg:flex lg:w-96 lg:flex-none lg:border-l lg:border-t-0 lg:bg-gray-50 lg:from-transparent lg:via-transparent lg:to-transparent">
                {renderQuestionBankPanel()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 p-3 sm:p-6 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:pt-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 max-lg:min-h-10 max-lg:text-sm sm:py-3 sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateQuiz}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg max-lg:min-h-10 max-lg:text-sm sm:py-3 sm:text-base lg:transform lg:hover:-translate-y-0.5"
                >
                  {editingQuiz ? "Save changes" : "Create Quiz"}
                </button>
              </div>
            </div>
          </div>
        </div>
        {mobileQuestionBankOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 lg:hidden"
            onClick={() => setMobileQuestionBankOpen(false)}
          >
            <div
              className="flex w-full max-w-lg max-h-[75vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl -translate-y-6 sm:-translate-y-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-3 py-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <h2 className="text-lg font-bold text-gray-900">Question bank</h2>
                <button
                  type="button"
                  onClick={() => setMobileQuestionBankOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
                  aria-label="Close question bank"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {renderQuestionBankPanel()}
              </div>
            </div>
          </div>
        )}
        </>
      )}

        {/* Generate Quiz Modal */}
        {generateModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm lg:z-50">
            <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  Generate Questions
                </h2>
                <button onClick={() => setGenerateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Question Type Selector */}
              <div className="mb-6 flex min-h-0 flex-1 flex-col">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Question Type</label>
                <select
                  value={generateQuestionType}
                  onChange={(e) => setGenerateQuestionType(e.target.value as "multiple_choice" | "true_false" | "fill_blank")}
                  disabled={generatingQuestions}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True or False</option>
                  <option value="fill_blank">Fill in the Blank</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  {generateQuestionType === "multiple_choice" && "Questions with 4 options each"}
                  {generateQuestionType === "true_false" && "Questions that can be answered as True or False"}
                  {generateQuestionType === "fill_blank" && "Questions with a blank space to fill"}
                </p>
              </div>

              {generatingQuestions && (
                <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-red-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-red-800 font-medium">Generating questions with Gemini…</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <p className="text-gray-600 mb-4">Select a lesson or PDF to generate questions from:</p>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {lessons.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-gray-500">
                    No lessons available. Create lessons first to generate questions.
                  </div>
                ) : (
                  [...lessons]
                  .sort((a, b) =>
                    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" })
                  )
                  .map((lesson) => {
                    const isGenerating = generatingForSourceId === lesson.id;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => !generatingQuestions && handleGenerateFromSource(lesson.id, "lesson")}
                        disabled={generatingQuestions}
                        className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-all duration-150 hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-gray-200 disabled:hover:bg-white"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-gray-800">{lesson.title}</div>
                          {isGenerating && (
                            <span className="shrink-0 flex items-center gap-1.5 text-red-600 text-sm font-medium">
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Generating…
                            </span>
                          )}
                        </div>
                        {lesson.description && (
                          <div className="text-sm text-gray-500 mt-1">{lesson.description}</div>
                        )}
                        {lesson.pdf_file_path && (
                          <div className="text-sm text-gray-500 mt-1">PDF: {lesson.pdf_file_path.split("/").pop()}</div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Question Modal */}
        {createQuestionModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm lg:z-50">
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  {editingBankQuestion ? "Edit Question" : "Create New Question"}
                </h2>
                <button onClick={() => setCreateQuestionModalOpen(false)} className="text-gray-500 hover:text-gray-700 cursor-pointer">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateQuestion();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Question Type</label>
                  <select
                    value={newQuestion.type}
                    onChange={(e) =>
                      setNewQuestion({ ...newQuestion, type: e.target.value as QuestionType })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="true_false">True or False</option>
                    <option value="fill_blank">Fill in the Blank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Question <span className="text-red-500">*</span></label>
                  <textarea
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    placeholder="Enter your question"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white resize-none"
                  />
                </div>

                {newQuestion.type === "multiple_choice" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Options</label>
                    <div className="space-y-2">
                      {newQuestion.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-gray-800 placeholder-text-gray-600 flex items-center justify-center text-xs font-semibold">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOptions = [...newQuestion.options];
                              newOptions[idx] = e.target.value;
                              setNewQuestion({ ...newQuestion, options: newOptions });
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setNewQuestion({ ...newQuestion, correctAnswer: idx })}
                            className={`p-2 rounded-lg transition-colors ${
                              newQuestion.correctAnswer === idx
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Click the checkmark to mark the correct answer</p>
                  </div>
                )}

                {newQuestion.type === "true_false" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Correct Answer</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setNewQuestion({ ...newQuestion, trueFalseAnswer: true })}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${
                          newQuestion.trueFalseAnswer
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        True
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewQuestion({ ...newQuestion, trueFalseAnswer: false })}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${
                          !newQuestion.trueFalseAnswer
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        False
                      </button>
                    </div>
                  </div>
                )}

                {newQuestion.type === "fill_blank" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Correct Answer</label>
                    <input
                      type="text"
                      value={newQuestion.fillBlankAnswer}
                      onChange={(e) => setNewQuestion({ ...newQuestion, fillBlankAnswer: e.target.value })}
                      placeholder="Enter the correct answer"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Source (Optional)</label>
                  <select
                    value={newQuestion.source}
                    onChange={(e) => setNewQuestion({ ...newQuestion, source: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 placeholder-text-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                  >
                    <option value="">None</option>
                    {[...lessons]
                      .sort((a, b) =>
                        a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" })
                      )
                      .map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.title}
                        </option>
                      ))}
                  </select>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCreateQuestionModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold shadow-lg transition-all duration-75 cursor-pointer hover:from-red-500 hover:to-rose-500 disabled:opacity-50"
                  >
                    {editingBankQuestion ? "Save changes" : "Create & Add to Quiz"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Quiz attempts & activity logs modal */}
      {monitoringQuizId && (
        <QuizMonitoringModal
          quizId={monitoringQuizId}
          quizName={monitoringQuizName}
          isOpen={!!monitoringQuizId}
          onClose={() => {
            setMonitoringQuizId(null);
            setMonitoringQuizName("");
          }}
        />
      )}

    </div>
  );
}
