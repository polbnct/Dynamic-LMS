"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/feedback/ToastProvider";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById } from "@/lib/supabase/queries/courses.client";
import { getLessons, getLessonPDFUrl } from "@/lib/supabase/queries/lessons";
import type { Lesson } from "@/lib/supabase/queries/lessons";
import {
  addStudentLessonFlashcard,
  getLessonStudyQuestions,
  getStudentLessonFlashcards,
  removeStudentLessonFlashcard,
  updateStudentLessonFlashcard,
  getStudyAidAttemptsForCourse,
  type StudyAidQuestion,
  type StudentLessonFlashcard,
} from "@/lib/supabase/queries/study-aid";
import {
  isModuleAssessmentLockActive,
  readModuleAssessmentLock,
} from "@/lib/module-assessment-lock";

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const MAX_FLASHCARD_WORDS = 30;

interface CourseStudyAidSettings {
  name?: string;
  code?: string;
  shuffle_study_aid_questions?: boolean | null;
  unlock_threshold_percent?: number | null;
  require_both_for_unlock?: boolean | null;
}

interface LessonWithUI extends Lesson {
  pdfUrl?: string;
  pdfFileName?: string;
  createdAt: string;
}

type FlashcardSource = "professor" | "student";

interface MergedFlashcard {
  id: string;
  question: string;
  answer: string;
  source: "professor" | "student";
  flashcardId?: string;
}

function getStudyAidAnswerMeta(correctAnswer: StudyAidQuestion["correct_answer"]) {
  if (correctAnswer && typeof correctAnswer === "object" && "answer" in correctAnswer) {
    return {
      answer: correctAnswer.answer,
      correctExplanation: correctAnswer.correct_explanation || "",
      incorrectExplanation: correctAnswer.incorrect_explanation || "",
    };
  }

  return {
    answer: correctAnswer,
    correctExplanation: "",
    incorrectExplanation: "",
  };
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function StudentContentPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { error: toastError, success: toastSuccess } = useToast();

  const [course, setCourse] = useState<CourseStudyAidSettings | null>(null);
  const [lessons, setLessons] = useState<LessonWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [studyAidModalOpen, setStudyAidModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonWithUI | null>(null);
  const [flashcardSource, setFlashcardSource] = useState<FlashcardSource>("professor");
  const [studyAidQuestions, setStudyAidQuestions] = useState<StudyAidQuestion[]>([]);
  const [studentFlashcards, setStudentFlashcards] = useState<StudentLessonFlashcard[]>([]);
  const [studyAidLoading, setStudyAidLoading] = useState(false);
  const [studyAidIndex, setStudyAidIndex] = useState(0);
  const [studyAidReveal, setStudyAidReveal] = useState(false);
  const [newFlashcardQuestion, setNewFlashcardQuestion] = useState("");
  const [newFlashcardAnswer, setNewFlashcardAnswer] = useState("");
  const [creatingFlashcard, setCreatingFlashcard] = useState(false);
  const [deletingFlashcardId, setDeletingFlashcardId] = useState<string | null>(null);
  const [isAddFlashcardModalOpen, setIsAddFlashcardModalOpen] = useState(false);
  const [isManageCardsModalOpen, setIsManageCardsModalOpen] = useState(false);
  const [editingFlashcardId, setEditingFlashcardId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState("");
  const [editingAnswer, setEditingAnswer] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [professorFlashcardOrder, setProfessorFlashcardOrder] = useState<string[] | null>(null);
  const [studentFlashcardOrder, setStudentFlashcardOrder] = useState<string[] | null>(null);
  const [studyAidAttempts, setStudyAidAttempts] = useState<
    { lesson_id: string; question_type: string; score: number; max_score: number }[]
  >([]);
  const [expandedLessonIds, setExpandedLessonIds] = useState<Set<string>>(new Set());
  const [lessonSummaryById, setLessonSummaryById] = useState<
    Record<string, { loading: boolean; summary: string | null; error?: string }>
  >({});
  const [questionsShuffleNonce, setQuestionsShuffleNonce] = useState(0);
  const [assessmentLockedByOtherTab, setAssessmentLockedByOtherTab] = useState(false);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        const lessonsData = await getLessons(courseId);
        setLessons(lessonsData.map((lesson) => ({
          ...lesson,
          pdfUrl: lesson.pdf_file_path ? getLessonPDFUrl(lesson.pdf_file_path) : undefined,
          pdfFileName: lesson.pdf_file_path ? lesson.pdf_file_path.split("/").pop() : undefined,
          createdAt: lesson.created_at,
        })));
        const attempts = await getStudyAidAttemptsForCourse(courseId);
        setStudyAidAttempts(attempts);
      } catch (err) {
        console.error("Error fetching course:", err);
        toastError(err instanceof Error ? err.message : "Failed to load course content.");
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId, toastError]);

  useEffect(() => {
    const syncLockState = () => {
      const lock = readModuleAssessmentLock();
      if (!lock || !isModuleAssessmentLockActive(lock)) {
        setAssessmentLockedByOtherTab(false);
        return;
      }
      setAssessmentLockedByOtherTab(true);
    };

    syncLockState();
    const onStorage = () => syncLockState();
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(syncLockState, 3000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, []);

  const isSummaryQuestion = (q: StudyAidQuestion) =>
    q.type === "summary" ||
    (q.type === "fill_blank" && String(q.correct_answer ?? "").toLowerCase().includes("summary"));

  const shouldShuffleStudyAidQuestions =
    course?.shuffle_study_aid_questions === undefined || course?.shuffle_study_aid_questions === null
      ? true
      : Boolean(course.shuffle_study_aid_questions);

  const handleStudyAid = async (lesson: LessonWithUI) => {
    setSelectedLesson(lesson);
    setStudyAidModalOpen(true);
    setFlashcardSource("professor");
    setIsAddFlashcardModalOpen(false);
    setIsManageCardsModalOpen(false);
    setEditingFlashcardId(null);
    setEditingQuestion("");
    setEditingAnswer("");
    setProfessorFlashcardOrder(null);
    setStudentFlashcardOrder(null);
    setStudyAidQuestions([]);
    setStudentFlashcards([]);
    setStudyAidIndex(0);
    setStudyAidReveal(false);
    setNewFlashcardQuestion("");
    setNewFlashcardAnswer("");
    setQuestionsShuffleNonce((prev) => prev + 1);
    setStudyAidLoading(true);
    try {
      const [questions, privateFlashcards] = await Promise.all([
        getLessonStudyQuestions(lesson.id),
        getStudentLessonFlashcards(lesson.id),
      ]);
      setStudyAidQuestions(questions);
      setStudentFlashcards(privateFlashcards);
    } catch (err) {
      console.error("Error loading study aid:", err);
      toastError(err instanceof Error ? err.message : "Failed to load study aid.");
    } finally {
      setStudyAidLoading(false);
    }
  };

  const toggleLessonSummary = async (lesson: LessonWithUI) => {
    setExpandedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lesson.id)) next.delete(lesson.id);
      else next.add(lesson.id);
      return next;
    });

    if (lessonSummaryById[lesson.id]?.summary !== undefined || lessonSummaryById[lesson.id]?.loading) return;

    setLessonSummaryById((prev) => ({
      ...prev,
      [lesson.id]: { loading: true, summary: null },
    }));

    try {
      const questions = await getLessonStudyQuestions(lesson.id);
      const summaryQuestion = questions.find((q) => isSummaryQuestion(q));
      setLessonSummaryById((prev) => ({
        ...prev,
        [lesson.id]: {
          loading: false,
          summary: summaryQuestion?.question?.trim() || null,
        },
      }));
    } catch (err) {
      setLessonSummaryById((prev) => ({
        ...prev,
        [lesson.id]: {
          loading: false,
          summary: null,
          error: err instanceof Error ? err.message : "Failed to load summary.",
        },
      }));
    }
  };

  const professorFlashcards: MergedFlashcard[] = studyAidQuestions
    .filter((q) => q.type === "true_false")
    .map((q) => {
      const { answer } = getStudyAidAnswerMeta(q.correct_answer);
      return {
        id: `prof-${q.id}`,
        question: q.question,
        answer: String(answer),
        source: "professor" as const,
      };
    });

  const privateFlashcards: MergedFlashcard[] = studentFlashcards.map((card) => ({
    id: `student-${card.id}`,
    question: card.question,
    answer: card.answer,
    source: "student" as const,
    flashcardId: card.id,
  }));

  const applyFlashcardOrder = (cards: MergedFlashcard[], order: string[] | null) => {
    if (!order || order.length === 0) return cards;
    const rank = new Map(order.map((id, idx) => [id, idx]));
    return [...cards].sort((a, b) => {
      const rankA = rank.get(a.id);
      const rankB = rank.get(b.id);
      if (rankA === undefined && rankB === undefined) return 0;
      if (rankA === undefined) return 1;
      if (rankB === undefined) return -1;
      return rankA - rankB;
    });
  };

  const displayedProfessorFlashcards = applyFlashcardOrder(
    professorFlashcards,
    professorFlashcardOrder
  );
  const displayedPrivateFlashcards = applyFlashcardOrder(
    privateFlashcards,
    studentFlashcardOrder
  );

  const activeFlashcards =
    flashcardSource === "professor" ? displayedProfessorFlashcards : displayedPrivateFlashcards;
  const multipleChoiceQuestions = useMemo(() => {
    void questionsShuffleNonce;
    const list = studyAidQuestions.filter((q) => q.type === "multiple_choice");
    return shouldShuffleStudyAidQuestions ? shuffleArray(list) : list;
  }, [studyAidQuestions, shouldShuffleStudyAidQuestions, questionsShuffleNonce]);

  const fillBlankQuestions = useMemo(() => {
    void questionsShuffleNonce;
    const list = studyAidQuestions.filter((q) => q.type === "fill_blank" && !isSummaryQuestion(q));
    return shouldShuffleStudyAidQuestions ? shuffleArray(list) : list;
  }, [studyAidQuestions, shouldShuffleStudyAidQuestions, questionsShuffleNonce]);

  const currentList = activeFlashcards;
  const currentQuestion = currentList[studyAidIndex];
  const hasAnyQuestions = studyAidQuestions.length > 0 || studentFlashcards.length > 0;
  const professorGeneratedQuestionCount = multipleChoiceQuestions.length + fillBlankQuestions.length;

  const handleFlashcardSourceChange = (nextSource: FlashcardSource) => {
    setFlashcardSource(nextSource);
    setStudyAidIndex(0);
    setStudyAidReveal(false);
    setIsAddFlashcardModalOpen(false);
    setIsManageCardsModalOpen(false);
  };

  const handleAddFlashcard = async () => {
    if (!selectedLesson || creatingFlashcard) return;
    const question = newFlashcardQuestion.trim();
    const answer = newFlashcardAnswer.trim();
    if (!question || !answer) {
      toastError("Question and answer are required.");
      return;
    }
    setCreatingFlashcard(true);
    try {
      const created = await addStudentLessonFlashcard(selectedLesson.id, { question, answer });
      setStudentFlashcards((prev) => [...prev, created]);
      setStudentFlashcardOrder((prev) => (prev ? [...prev, `student-${created.id}`] : prev));
      setNewFlashcardQuestion("");
      setNewFlashcardAnswer("");
      setFlashcardSource("student");
      setStudyAidIndex(privateFlashcards.length);
      toastSuccess("Flashcard created successfully!");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Failed to add flashcard.");
    } finally {
      setCreatingFlashcard(false);
    }
  };

  const handleDeleteFlashcard = async (flashcardId: string) => {
    if (!selectedLesson || !flashcardId) return;
    setDeletingFlashcardId(flashcardId);
    try {
      await removeStudentLessonFlashcard(selectedLesson.id, flashcardId);
      setStudentFlashcardOrder((prev) =>
        prev ? prev.filter((id) => id !== `student-${flashcardId}`) : prev
      );
      setStudentFlashcards((prev) => {
        const next = prev.filter((card) => card.id !== flashcardId);
        const nextLength =
          flashcardSource === "student" ? next.length : displayedProfessorFlashcards.length;
        setStudyAidIndex((current) => Math.min(current, Math.max(0, nextLength - 1)));
        return next;
      });
      if (editingFlashcardId === flashcardId) {
        setEditingFlashcardId(null);
        setEditingQuestion("");
        setEditingAnswer("");
      }
      setStudyAidReveal(false);
      toastSuccess("Flashcard deleted successfully!");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Failed to delete flashcard.");
    } finally {
      setDeletingFlashcardId(null);
    }
  };

  const handleStartEditFlashcard = (card: StudentLessonFlashcard) => {
    setEditingFlashcardId(card.id);
    setEditingQuestion(card.question);
    setEditingAnswer(card.answer);
  };

  const handleSaveFlashcardEdit = async () => {
    if (!selectedLesson || !editingFlashcardId || savingEdit) return;
    const question = editingQuestion.trim();
    const answer = editingAnswer.trim();
    if (!question || !answer) {
      toastError("Question and answer are required.");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updateStudentLessonFlashcard(selectedLesson.id, editingFlashcardId, {
        question,
        answer,
      });
      setStudentFlashcards((prev) =>
        prev.map((card) => (card.id === updated.id ? updated : card))
      );
      setEditingFlashcardId(null);
      setEditingQuestion("");
      setEditingAnswer("");
      toastSuccess("Flashcard updated successfully!");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Failed to update flashcard.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleShuffleCurrentFlashcards = () => {
    const ids = activeFlashcards.map((card) => card.id);
    let shuffledIds = shuffleArray(ids);
    if (ids.length > 1 && shuffledIds.every((id, idx) => id === ids[idx])) {
      // Ensure visible reordering if shuffle returns identical order.
      shuffledIds = [...ids.slice(1), ids[0]];
    }
    if (flashcardSource === "professor") {
      setProfessorFlashcardOrder(shuffledIds);
    } else {
      setStudentFlashcardOrder(shuffledIds);
    }
    setStudyAidIndex(0);
    setStudyAidReveal(false);
  };

  const PASSING_PERCENT = Math.min(
    100,
    Math.max(1, Math.round(Number(course?.unlock_threshold_percent ?? 70)))
  );
  const REQUIRE_BOTH_FOR_UNLOCK =
    course?.require_both_for_unlock === undefined || course?.require_both_for_unlock === null
      ? true
      : Boolean(course.require_both_for_unlock);

  // Unlocking is sequential across categories: Prelim -> Midterm -> Finals
  const orderedLessons = [
    ...lessons.filter((l) => l.category === "prelim"),
    ...lessons.filter((l) => l.category === "midterm"),
    ...lessons.filter((l) => l.category === "finals"),
  ].sort((a, b) => {
    if (a.category !== b.category) {
      const rank: Record<string, number> = { prelim: 0, midterm: 1, finals: 2 };
      return (rank[a.category] ?? 999) - (rank[b.category] ?? 999);
    }
    return a.order - b.order;
  });

  // Combined mastery: based on MC + Fill-in-the-Blank together.
  // We take best attempt per type (by pct), then compute:
  // ((overall correct answers) / (overall number of questions)) * 100
  const bestByLessonAndType: Record<string, { score: number; max: number; pct: number }> = {};
  for (const a of studyAidAttempts) {
    const type = a.question_type;
    if (type !== "multiple_choice" && type !== "fill_blank") continue;
    const key = `${a.lesson_id}:${type}`;
    const pct = a.max_score > 0 ? (a.score / a.max_score) * 100 : 0;
    const existing = bestByLessonAndType[key];
    if (!existing || pct > existing.pct) {
      bestByLessonAndType[key] = { score: a.score, max: a.max_score, pct };
    }
  }

  const combinedPctByLesson: Record<string, number> = {};
  for (const lesson of orderedLessons) {
    const mc = bestByLessonAndType[`${lesson.id}:multiple_choice`];
    const fib = bestByLessonAndType[`${lesson.id}:fill_blank`];
    if (REQUIRE_BOTH_FOR_UNLOCK && (!mc || !fib)) {
      combinedPctByLesson[lesson.id] = 0;
      continue;
    }
    const totalQuestions = (mc?.max || 0) + (fib?.max || 0);
    const overallCorrectAnswers = (mc?.score || 0) + (fib?.score || 0);
    combinedPctByLesson[lesson.id] = totalQuestions > 0 ? (overallCorrectAnswers / totalQuestions) * 100 : 0;
  }

  const unlockedLessonIds = new Set<string>();
  orderedLessons.forEach((lesson, i) => {
    if (i === 0) unlockedLessonIds.add(lesson.id);
    else if (combinedPctByLesson[orderedLessons[i - 1].id] >= PASSING_PERCENT) unlockedLessonIds.add(lesson.id);
  });

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
        <StudentNavbar currentPage="courses" />
        <StudentCourseNavbar courseId={courseId} currentPage="content" />
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
      {/* Main Student Navbar */}
      <StudentNavbar currentPage="courses" />
      
      {/* Student Course Navbar */}
      <StudentCourseNavbar
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
            href="/student/dashboard"
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
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 break-words">
              Course Content
            </h1>
            <p className="text-sm sm:text-base text-gray-600 truncate">
              {course?.name} ({course?.code}) • {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            </p>
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
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No lessons available</h3>
              <p className="text-gray-600">Lessons will appear here when your professor adds them</p>
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
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                  <span className="inline-flex items-center rounded-full border border-gray-900 bg-white px-3 py-1 text-sm font-semibold text-gray-900">
                      {categoryLessons.length} lesson{categoryLessons.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Lessons List */}
                  <div className="space-y-4">
                    {categoryLessons.map((lesson) => {
                      const isUnlocked = unlockedLessonIds.has(lesson.id);
                      return (
                      <div
                        key={lesson.id}
                        className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border p-4 sm:p-6 transition-all duration-200 ${isUnlocked ? "border-gray-200 hover:shadow-xl" : "border-gray-200 opacity-80"}`}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="min-w-0 w-full">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 truncate" title={lesson.title}
                            >{lesson.title}</h3>
                            {!isUnlocked && (
                              <p className="text-amber-800 text-sm font-medium mb-1">
                                {REQUIRE_BOTH_FOR_UNLOCK
                                  ? `Complete both MCQ and Fill in the Blank in the previous lesson and reach at least ${PASSING_PERCENT}% to unlock.`
                                  : `Complete study aid in the previous lesson and reach at least ${PASSING_PERCENT}% to unlock.`}
                              </p>
                            )}
                            {lesson.description && (
                              <p className="text-gray-600 mb-4 break-words">{lesson.description}</p>
                            )}
                            {isUnlocked && (
                              <div className="mb-1">
                                <button
                                  type="button"
                                  onClick={() => toggleLessonSummary(lesson)}
                                  className="inline-flex w-fit max-w-full items-center gap-2 text-left text-sm font-semibold text-red-700 hover:text-red-800"
                                >
                                  <svg className={`h-4 w-4 shrink-0 transition-transform ${expandedLessonIds.has(lesson.id) ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                  <span className="min-w-0 whitespace-normal">
                                    {expandedLessonIds.has(lesson.id) ? "Hide lesson summary" : "Show lesson summary"}
                                  </span>
                                </button>
                                {expandedLessonIds.has(lesson.id) && (
                                  <div className="mt-3 p-4 rounded-xl border border-red-100 bg-red-50/60">
                                    {lessonSummaryById[lesson.id]?.loading ? (
                                      <p className="text-sm text-gray-600">Loading summary...</p>
                                    ) : lessonSummaryById[lesson.id]?.error ? (
                                      <p className="text-sm text-red-700">{lessonSummaryById[lesson.id]?.error}</p>
                                    ) : lessonSummaryById[lesson.id]?.summary ? (
                                      <div className="max-h-40 overflow-y-auto pr-1">
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                          {lessonSummaryById[lesson.id]?.summary}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-600">
                                        No summary available for this lesson yet.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Full-width row below copy: avoids flex-1/min-w-0 crushing the summary next to a fixed sidebar */}
                          <div className="flex w-full flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
                            {lesson.pdfUrl &&
                              (isUnlocked ? (
                                <a
                                  href={lesson.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex py-2 sm:h-11 w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 sm:px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:min-w-[12rem] sm:max-w-md sm:flex-initial"
                                >
                                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  <span className="min-w-0 truncate">
                                    View PDF
                                    {lesson.pdfFileName && (
                                      <span className="font-normal text-gray-500"> ({lesson.pdfFileName})</span>
                                    )}
                                  </span>
                                </a>
                              ) : (
                                <span className="inline-flex py-2 sm:h-11 w-full min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-6 sm:px-3 text-sm font-medium text-slate-500 sm:min-w-[12rem] sm:max-w-md sm:flex-initial">
                                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  View PDF (locked)
                                </span>
                              ))}
                            {isUnlocked ? (
                              <button
                                type="button"
                                onClick={() => handleStudyAid(lesson)}
                                className="inline-flex py-2 sm:h-11 w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md sm:w-56 sm:flex-none"
                              >
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                Study Aid
                              </button>
                            ) : (
                              <span className="inline-flex py-2 sm:h-11 w-full min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-500 sm:w-56 sm:flex-none">
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Study Aid (locked)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ); })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Study Aid Modal */}
      {studyAidModalOpen && selectedLesson && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setStudyAidModalOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[94vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-4 border-b border-gray-200">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  Study Aid: {selectedLesson.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">Choose a study method</p>
              </div>
              <button
                onClick={() => setStudyAidModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Study Aid Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {studyAidLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
                </div>
              ) : !hasAnyQuestions ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">No study aid yet</h3>
                  <p className="text-gray-600">Your professor has not added study aid questions for this lesson yet.</p>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl py-4 sm:py-2">
                  
                  {/* Flashcard */}
                  <div className="mb-6 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                    <nav className="grid w-full grid-cols-2 gap-1.5" aria-label="Flashcard source">
                      <button
                        type="button"
                        onClick={() => handleFlashcardSourceChange("professor")}
                        className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                          flashcardSource === "professor"
                            ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm"
                            : "text-slate-700 hover:bg-slate-50 hover:text-red-700"
                        }`}
                        aria-current={flashcardSource === "professor" ? "page" : undefined}
                      >
                        Professor ({professorFlashcards.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlashcardSourceChange("student")}
                        className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                          flashcardSource === "student"
                            ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm"
                            : "text-slate-700 hover:bg-slate-50 hover:text-red-700"
                        }`}
                        aria-current={flashcardSource === "student" ? "page" : undefined}
                      >
                        My Flashcards ({privateFlashcards.length})
                      </button>
                    </nav>
                  </div>
                    {currentQuestion ? (
                      <div className="space-y-4">
                        <button
                          type="button"
                          onClick={() => setStudyAidReveal((r) => !r)}
                          className="relative w-full sm:w-3/4 mx-auto block bg-white rounded-xl shadow-lg border border-gray-200 p-6 min-h-[240px] hover:shadow-xl hover:border-red-300 transition-all overflow-x-auto group"
                        >
                          <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
                            <div
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                                (currentQuestion as MergedFlashcard).source === "student"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {(currentQuestion as MergedFlashcard).source === "student" ? "My Card" : "Professor"}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-center w-full sm:min-w-[240px] h-full min-h-[220px] sm:min-h-[240px] pt-6 pb-8 cursor-pointer">
                            <p className="text-xl font-semibold text-gray-700 leading-relaxed text-center break-word whitespace-normal max-w-full">
                              {studyAidReveal
                                ? (currentQuestion as MergedFlashcard).answer
                                : (currentQuestion as MergedFlashcard).question}
                            </p>
                          </div>
                          
                          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2">
                            <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              Card {studyAidIndex + 1} / {currentList.length}
                            </div>
                          </div>
                        </button>
                        
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-sm text-gray-500">{studyAidReveal ? "Click to flip answer" : "Click to flip question"}</p>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => { setStudyAidIndex((i) => Math.max(0, i - 1)); setStudyAidReveal(false); }}
                              disabled={studyAidIndex === 0}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 sm:px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <p>Previous</p>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setStudyAidIndex((i) => Math.min(currentList.length - 1, i + 1)); setStudyAidReveal(false); }}
                              disabled={studyAidIndex === currentList.length - 1}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-3 sm:px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <p>Next</p>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-gray-200 pt-4">
                            <button
                              type="button"
                              onClick={handleShuffleCurrentFlashcards}
                              disabled={activeFlashcards.length <= 1}
                              title="Shuffle cards"
                              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2 sm:px-3 py-2 sm:py-2.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer gap-1 sm:gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <p className="hidden sm:inline">Shuffle</p>
                            </button>
                            {flashcardSource === "student" && (
                              <button
                                type="button"
                                onClick={() => setIsAddFlashcardModalOpen(true)}
                                title="Add new card"
                                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2 sm:px-3 py-2 sm:py-2.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100 cursor-pointer gap-1 sm:gap-2"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <p className="hidden sm:inline">Add Card</p>
                              </button>
                            )}
                            {flashcardSource === "student" && (
                            <button
                              type="button"
                              onClick={() => setIsManageCardsModalOpen(true)}
                              title="Manage cards"
                              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2 sm:px-3 py-2 sm:py-2.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100 cursor-pointer gap-1 sm:gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <p className="hidden sm:inline">Manage Cards</p>
                            </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                        <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-sm font-medium text-slate-700 mb-4">
                          {flashcardSource === "student"
                            ? "No personal flashcards yet."
                            : "No professor flashcards available."}
                        </p>
                        {flashcardSource === "student" && (
                          <button
                            type="button"
                            onClick={() => setIsAddFlashcardModalOpen(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md cursor-pointer"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Your First Card
                          </button>
                        )}
                      </div>
                    )}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    {selectedLesson && professorGeneratedQuestionCount > 0 ? (
                      <Link
                        href={`/student/dashboard/${courseId}/content/${selectedLesson.id}/questions`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-disabled={assessmentLockedByOtherTab}
                        onClick={(e) => {
                          if (assessmentLockedByOtherTab) e.preventDefault();
                        }}
                        className={`group inline-flex h-12 w-full items-center justify-between rounded-xl px-4 text-sm font-semibold shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                          assessmentLockedByOtherTab
                            ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500 shadow-none"
                            : "border border-slate-300 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-lg"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                            />
                          </svg>
                          Take Module Assessment
                        </span>
                        {assessmentLockedByOtherTab ? (
                          <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-slate-600">
                            Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-bold tracking-wide text-slate-700">
                            {professorGeneratedQuestionCount} items
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-500">
                        No professor questions available yet
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
              <button
                onClick={() => setStudyAidModalOpen(false)}
                className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Flashcard Modal */}
      {isAddFlashcardModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAddFlashcardModalOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Add Flashcard</h3>
              <button
                onClick={() => setIsAddFlashcardModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                <input
                  type="text"
                  value={newFlashcardQuestion}
                  onChange={(e) => setNewFlashcardQuestion(e.target.value)}
                  placeholder="Enter the question"
                  maxLength={256}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800 placeholder-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-gray-500 mt-1">{countWords(newFlashcardQuestion)}/{MAX_FLASHCARD_WORDS} words</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Answer</label>
                <input
                  type="text"
                  value={newFlashcardAnswer}
                  onChange={(e) => setNewFlashcardAnswer(e.target.value)}
                  placeholder="Enter the answer"
                  maxLength={256}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800 placeholder-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-gray-500 mt-1">{countWords(newFlashcardAnswer)}/{MAX_FLASHCARD_WORDS} words</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-4 sm:p-4 bg-gray-50 flex gap-4">
              <button
                onClick={() => setIsAddFlashcardModalOpen(false)}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-700 shadow-sm transition hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAddFlashcard();
                  if (!creatingFlashcard && newFlashcardQuestion.trim() && newFlashcardAnswer.trim()) {
                    setIsAddFlashcardModalOpen(false);
                  }
                }}
                disabled={creatingFlashcard}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3 py-2 font-semibold text-white shadow-sm transition transition-all duration-200 hover:shadow-md hover:from-red-700 hover:to-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {creatingFlashcard ? "Creating..." : "Create Card"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Cards Modal */}
      {isManageCardsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsManageCardsModalOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Manage Flashcards</h3>
              <button
                onClick={() => setIsManageCardsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {flashcardSource === "student" ? (
                studentFlashcards.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-sm text-gray-600 mb-4">No personal flashcards yet.</p>
                    <button
                      type="button"
                      onClick={() => setIsAddFlashcardModalOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Your First Card
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studentFlashcards.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition"
                      >
                        {editingFlashcardId === card.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Question</label>
                              <input
                                type="text"
                                value={editingQuestion}
                                onChange={(e) => setEditingQuestion(e.target.value)}
                                maxLength={500}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                                placeholder="Enter question"
                                
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Answer</label>
                              <input
                                type="text"
                                value={editingAnswer}
                                onChange={(e) => setEditingAnswer(e.target.value)}
                                maxLength={500}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                                placeholder="Enter answer"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFlashcardId(null);
                                  setEditingQuestion("");
                                  setEditingAnswer("");
                                }}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveFlashcardEdit}
                                disabled={savingEdit}
                                className="rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:from-red-700 hover:to-rose-700 disabled:opacity-50 cursor-pointer"
                              >
                                {savingEdit ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-bold text-gray-800 mb-1 break-words">Question: {card.question}</p>
                            <p className="text-sm font-semibold text-gray-600 mb-3 break-words">Answer: {card.answer}</p>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditFlashcard(card)}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-slate-100 cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFlashcard(card.id)}
                                disabled={deletingFlashcardId === card.id}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                              >
                                {deletingFlashcardId === card.id ? "..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-600">Editing and deleting are available only in <strong>My Flashcards</strong> tab.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
              <button
                onClick={() => setIsManageCardsModalOpen(false)}
                className="w-full rounded-lg bg-gray-300 px-4 py-3 font-semibold text-gray-800 transition hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

