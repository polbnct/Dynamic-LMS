"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSyncMessagesToToast, useToast } from "@/components/feedback/ToastProvider";
import StudentNavbar from "@/utils/StudentNavbar";
import StudentCourseNavbar from "@/utils/StudentCourseNavbar";
import { getCourseById } from "@/lib/supabase/queries/courses.client";
import { getLessons, getLessonPDFUrl } from "@/lib/supabase/queries/lessons";
import type { Lesson } from "@/lib/supabase/queries/lessons";
import { getLessonStudyQuestions, submitStudyAidAttempt, getStudyAidAttemptsForCourse, type StudyAidQuestion } from "@/lib/supabase/queries/study-aid";
import { areStudyAidAnswersEquivalent } from "@/lib/study-aid-symbols";

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const DISCRETE_SYMBOLS = ["∪", "∩", "⊆", "⊂", "∈", "∉", "∅", "U", "×", "¬", "∧", "∨", "→", "↔"] as const;

interface LessonWithUI extends Lesson {
  pdfUrl?: string;
  pdfFileName?: string;
  createdAt: string;
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

export default function StudentContentPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { error: toastError } = useToast();

  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<LessonWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [studyAidModalOpen, setStudyAidModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonWithUI | null>(null);
  const [studyAidType, setStudyAidType] = useState<"flashcards" | "multiple_choice" | "fill_blank">("flashcards");
  const [studyAidQuestions, setStudyAidQuestions] = useState<StudyAidQuestion[]>([]);
  const [studyAidLoading, setStudyAidLoading] = useState(false);
  const [studyAidIndex, setStudyAidIndex] = useState(0);
  const [studyAidReveal, setStudyAidReveal] = useState(false);
  const [studyAidAnswers, setStudyAidAnswers] = useState<Record<string, number | string>>({});
  const [studyAidScoreSubmitted, setStudyAidScoreSubmitted] = useState(false);
  const [studyAidSubmitting, setStudyAidSubmitting] = useState(false);
  const [studyAidSubmitError, setStudyAidSubmitError] = useState<string | null>(null);
  const [studyAidAttempts, setStudyAidAttempts] = useState<
    { lesson_id: string; question_type: string; score: number; max_score: number }[]
  >([]);
  const [expandedLessonIds, setExpandedLessonIds] = useState<Set<string>>(new Set());
  const [lessonSummaryById, setLessonSummaryById] = useState<
    Record<string, { loading: boolean; summary: string | null; error?: string }>
  >({});

  useSyncMessagesToToast(studyAidSubmitError ?? "", "");

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
    setStudyAidType("flashcards");
    setStudyAidQuestions([]);
    setStudyAidIndex(0);
    setStudyAidReveal(false);
    setStudyAidAnswers({});
    setStudyAidScoreSubmitted(false);
    setStudyAidSubmitError(null);
    setStudyAidLoading(true);
    try {
      const questions = await getLessonStudyQuestions(lesson.id);
      setStudyAidQuestions(shouldShuffleStudyAidQuestions ? shuffleArray(questions) : questions);
    } catch (err) {
      console.error("Error loading study aid:", err);
      toastError(err instanceof Error ? err.message : "Failed to load study aid.");
    } finally {
      setStudyAidLoading(false);
    }
  };

  const questionsByType = (type: "flashcards" | "summary" | "multiple_choice" | "fill_blank") => {
    if (type === "flashcards") return studyAidQuestions.filter((q) => q.type === "true_false");
    if (type === "multiple_choice") return studyAidQuestions.filter((q) => q.type === "multiple_choice");
    if (type === "fill_blank")
      return studyAidQuestions.filter((q) => q.type === "fill_blank" && !isSummaryQuestion(q));
    return [];
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

  const currentList = questionsByType(studyAidType);
  const currentQuestion = currentList[studyAidIndex];
  const currentAnswerMeta = currentQuestion ? getStudyAidAnswerMeta(currentQuestion.correct_answer) : null;
  const hasAnyQuestions = studyAidQuestions.length > 0;
  const hasQuestionsForType = currentList.length > 0;

  const isAnswerableType = studyAidType === "multiple_choice" || studyAidType === "fill_blank";
  const allAnswered =
    isAnswerableType &&
    currentList.length > 0 &&
    currentList.every((q) =>
      studyAidType === "multiple_choice"
        ? studyAidAnswers[q.id] !== undefined
        : (studyAidAnswers[q.id] ?? "").toString().trim() !== ""
    );
  const score = isAnswerableType
    ? currentList.filter((q) => {
        const { answer: correct } = getStudyAidAnswerMeta(q.correct_answer);
        const ans = studyAidAnswers[q.id];
        if (ans === undefined && studyAidType === "fill_blank") return false;
        if (q.type === "multiple_choice") return Number(correct) === Number(ans);
        return areStudyAidAnswersEquivalent(ans, correct);
      }).length
    : 0;
  const maxScore = currentList.length;

  const handleSubmitAnswers = async () => {
    if (!selectedLesson || !allAnswered || studyAidSubmitting || maxScore === 0) return;
    setStudyAidSubmitting(true);
    setStudyAidSubmitError(null);
    try {
      const fillBlankAnswers =
        studyAidType === "fill_blank"
          ? currentList.map((q) => {
              const { answer: correct } = getStudyAidAnswerMeta(q.correct_answer);
              return {
                student_answer: String(studyAidAnswers[q.id] ?? ""),
                correct_answer: String(correct ?? ""),
              };
            })
          : undefined;
      await submitStudyAidAttempt(
        selectedLesson.id,
        studyAidType as "multiple_choice" | "fill_blank",
        score,
        maxScore,
        fillBlankAnswers
      );
      setStudyAidScoreSubmitted(true);
      setStudyAidReveal(true);
      setStudyAidAttempts((prev) => [
        ...prev,
        {
          lesson_id: selectedLesson.id,
          question_type: studyAidType,
          score,
          max_score: maxScore,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save attempt";
      setStudyAidSubmitError(message);
      console.error("Failed to save study aid score:", err);
    } finally {
      setStudyAidSubmitting(false);
    }
  };

  const handleTakeAgain = () => {
    setStudyAidScoreSubmitted(false);
    setStudyAidReveal(false);
    setStudyAidAnswers({});
    setStudyAidIndex(0);
    setStudyAidSubmitError(null);
    setStudyAidQuestions((prev) => (shouldShuffleStudyAidQuestions ? shuffleArray(prev) : prev));
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
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
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
                        <div className="flex flex-col gap-2">
                          <div className="w-full">
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
                              <div className="mb-4">
                                <button
                                  type="button"
                                  onClick={() => toggleLessonSummary(lesson)}
                                  className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-800"
                                >
                                  <svg className={`w-4 h-4 transition-transform ${expandedLessonIds.has(lesson.id) ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                  {expandedLessonIds.has(lesson.id) ? "Hide lesson summary" : "Show lesson summary"}
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
                            
                            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
                              <div className="w-full sm:w-auto">
                              {lesson.pdfUrl && (
                                isUnlocked ? (
                                  <a
                                    href={lesson.pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-gray-100 text-gray-800 hover:bg-gray-200 px-4 py-2 rounded-lg font-semibold transition-colors text-sm border border-gray-300"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    View PDF
                                    {lesson.pdfFileName && <span className="text-gray-500 font-normal truncate">({lesson.pdfFileName})</span>}
                                  </a>
                                ) : (
                                  <span className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-gray-200 text-gray-500 px-4 py-2 rounded-lg font-semibold text-sm border border-gray-300 cursor-not-allowed">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    View PDF (locked)
                                  </span>
                                )
                              )}
                            </div>

                            <div className="w-full sm:w-auto">
                              {isUnlocked ? (
                                <button
                                  onClick={() => handleStudyAid(lesson)}
                                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-sm"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                  </svg>
                                  Study Aid
                                </button>
                              ) : (
                                <span className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-gray-200 text-gray-500 px-4 py-2 rounded-lg font-semibold text-sm cursor-not-allowed">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                  Study Aid (locked)
                                </span>
                              )}
                              </div>
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

            {/* Study Aid Type Selection */}
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <label className="text-sm font-semibold text-gray-700 sm:shrink-0">Study method</label>
                <select
                  value={studyAidType}
                  onChange={(e) => {
                    const nextType = e.target.value as "flashcards" | "multiple_choice" | "fill_blank";
                    setStudyAidType(nextType);
                    setStudyAidIndex(0);
                    setStudyAidReveal(false);
                    if (nextType === "multiple_choice" || nextType === "fill_blank") {
                      setStudyAidAnswers({});
                      setStudyAidScoreSubmitted(false);
                      setStudyAidSubmitError(null);
                    }
                  }}
                  className="w-full sm:max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="flashcards">Flashcards</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="fill_blank">Fill in the blank</option>
                </select>
              </div>
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
              ) : !hasQuestionsForType ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No {studyAidType.replace("_", " ")} questions for this lesson.</p>
                </div>
              ) : studyAidType === "flashcards" && currentQuestion && (
                <div className="text-center py-4 sm:py-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Flashcards</h3>
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-3 sm:p-5 max-w-lg mx-auto">
                    <p className="text-gray-500 text-sm mb-3">Click to flip</p>
                    <button
                      type="button"
                      onClick={() => setStudyAidReveal((r) => !r)}
                      className="w-full bg-white rounded-xl shadow-lg p-4 sm:p-6 min-h-[140px] sm:min-h-[170px] flex items-center justify-center text-left hover:ring-2 hover:ring-red-300 transition-all"
                    >
                      <p className="text-base sm:text-lg font-semibold text-gray-700">
                        {studyAidReveal
                          ? typeof currentAnswerMeta?.answer === "boolean"
                            ? String(currentAnswerMeta?.answer)
                            : currentQuestion.type === "multiple_choice" && currentQuestion.options
                            ? currentQuestion.options[Number(currentAnswerMeta?.answer)] ?? String(currentAnswerMeta?.answer)
                            : String(currentAnswerMeta?.answer)
                          : currentQuestion.question}
                      </p>
                    </button>
                    <p className="text-sm text-gray-600 mt-2">{studyAidReveal ? "Answer" : "Question — click to flip"}</p>
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => { setStudyAidIndex((i) => Math.max(0, i - 1)); setStudyAidReveal(false); }}
                        disabled={studyAidIndex === 0}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">{studyAidIndex + 1} / {currentList.length}</span>
                      <button
                        type="button"
                        onClick={() => { setStudyAidIndex((i) => Math.min(currentList.length - 1, i + 1)); setStudyAidReveal(false); }}
                        disabled={studyAidIndex === currentList.length - 1}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {studyAidType === "multiple_choice" && currentQuestion && currentQuestion.options && (
                <div className="text-center py-4 sm:py-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Multiple Choice</h3>
                  {studyAidScoreSubmitted && (
                    <p className="mb-4 text-lg font-semibold text-red-700">
                      Score: {score} / {maxScore} ({(maxScore ? (score / maxScore) * 100 : 0).toFixed(0)}%) · Saved. You can take again to improve your score.
                    </p>
                  )}
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-3 sm:p-5 max-w-3xl mx-auto space-y-3">
                    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 text-left">
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mb-3">{currentQuestion.question}</p>
                      <div className="space-y-2">
                        {currentQuestion.options.map((option, idx) => (
                          <label
                            key={idx}
                            className={`flex items-center gap-3 p-2.5 sm:p-3 border rounded-lg transition-colors ${
                              studyAidScoreSubmitted
                                ? Number(currentAnswerMeta?.answer) === idx
                                  ? "border-green-500 bg-green-50"
                                  : studyAidAnswers[currentQuestion.id] === idx
                                    ? "border-red-400 bg-red-50"
                                    : "border-gray-200 bg-gray-50"
                                : studyAidAnswers[currentQuestion.id] === idx
                                  ? "border-red-500 bg-red-50 cursor-pointer"
                                  : "border-gray-300 hover:border-red-300 hover:bg-red-50/50 cursor-pointer"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`mc-${currentQuestion.id}`}
                              checked={studyAidAnswers[currentQuestion.id] === idx}
                              onChange={() => setStudyAidAnswers((prev) => ({ ...prev, [currentQuestion.id]: idx }))}
                              disabled={studyAidScoreSubmitted}
                              className="w-4 h-4 text-red-600"
                            />
                            <span className="font-medium text-gray-700">{String.fromCharCode(65 + idx)}. {option}</span>
                            {studyAidScoreSubmitted && Number(currentAnswerMeta?.answer) === idx && (
                              <span className="ml-auto text-green-600 text-sm font-medium">Correct</span>
                            )}
                          </label>
                        ))}
                      </div>
                      {studyAidScoreSubmitted && (
                        <div className="mt-4 space-y-1">
                          <p className="text-sm text-gray-600">
                            Correct answer: {currentQuestion.options[Number(currentAnswerMeta?.answer)]}
                          </p>
                          {(currentAnswerMeta?.correctExplanation || currentAnswerMeta?.incorrectExplanation) && (
                            <p
                              className={`text-sm ${
                                Number(currentAnswerMeta?.answer) === Number(studyAidAnswers[currentQuestion.id])
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              {Number(currentAnswerMeta?.answer) === Number(studyAidAnswers[currentQuestion.id])
                                ? currentAnswerMeta?.correctExplanation
                                : currentAnswerMeta?.incorrectExplanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setStudyAidIndex((i) => Math.max(0, i - 1))}
                        disabled={studyAidIndex === 0}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">{studyAidIndex + 1} / {currentList.length}</span>
                      <button
                        type="button"
                        onClick={() => setStudyAidIndex((i) => Math.min(currentList.length - 1, i + 1))}
                        disabled={studyAidIndex === currentList.length - 1}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        Next
                      </button>
                      {!studyAidScoreSubmitted ? (
                        <button
                          type="button"
                          onClick={handleSubmitAnswers}
                          disabled={!allAnswered || studyAidSubmitting}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {studyAidSubmitting ? "Submitting…" : "Submit answers"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleTakeAgain}
                          className="px-6 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600"
                        >
                          Take again
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {studyAidType === "fill_blank" && currentQuestion && (
                <div className="text-center py-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Fill in the blank</h3>
                  {studyAidScoreSubmitted && (
                    <p className="mb-4 text-lg font-semibold text-red-700">
                      Score: {score} / {maxScore} ({(maxScore ? (score / maxScore) * 100 : 0).toFixed(0)}%) · Saved. You can take again to improve your score.
                    </p>
                  )}
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-4 sm:p-8 max-w-2xl mx-auto space-y-4">
                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-left">
                      <p className="text-lg font-semibold text-gray-800 mb-4">{currentQuestion.question}</p>
                      <input
                        type="text"
                        value={String(studyAidAnswers[currentQuestion.id] ?? "")}
                        onChange={(e) =>
                          setStudyAidAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                        }
                        placeholder="Type your answer here"
                        disabled={studyAidScoreSubmitted}
                        className="w-full px-4 py-3 border border-gray-300 text-gray-800 placeholder-text-gray-800 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {DISCRETE_SYMBOLS.map((symbol) => (
                          <button
                            key={symbol}
                            type="button"
                            disabled={studyAidScoreSubmitted}
                            onClick={() => {
                              setStudyAidAnswers((prev) => ({
                                ...prev,
                                [currentQuestion.id]: `${String(prev[currentQuestion.id] ?? "")}${symbol}`,
                              }));
                            }}
                            className="px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {symbol}
                          </button>
                        ))}
                      </div>
                      {studyAidScoreSubmitted && (
                        <div className="mt-4 space-y-2">
                          {(() => {
                            const isCorrect =
                              areStudyAidAnswersEquivalent(
                                String(studyAidAnswers[currentQuestion.id]),
                                String(currentAnswerMeta?.answer)
                              );
                            return (
                              <>
                          <p className="text-sm text-gray-600">Your answer: {String(studyAidAnswers[currentQuestion.id] ?? "").trim() || "(blank)"}</p>
                                <p className={`text-sm font-medium ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                                  {isCorrect
                              ? "Correct!"
                              : `Correct answer: ${String(currentAnswerMeta?.answer)}`}
                                </p>
                                {(currentAnswerMeta?.correctExplanation || currentAnswerMeta?.incorrectExplanation) && (
                                  <p className={`text-sm ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                                    {isCorrect ? currentAnswerMeta?.correctExplanation : currentAnswerMeta?.incorrectExplanation}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setStudyAidIndex((i) => Math.max(0, i - 1))}
                        disabled={studyAidIndex === 0}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">{studyAidIndex + 1} / {currentList.length}</span>
                      <button
                        type="button"
                        onClick={() => setStudyAidIndex((i) => Math.min(currentList.length - 1, i + 1))}
                        disabled={studyAidIndex === currentList.length - 1}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        Next
                      </button>
                      {!studyAidScoreSubmitted ? (
                        <button
                          type="button"
                          onClick={handleSubmitAnswers}
                          disabled={!allAnswered || studyAidSubmitting}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {studyAidSubmitting ? "Submitting…" : "Submit answers"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleTakeAgain}
                          className="px-6 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600"
                        >
                          Take again
                        </button>
                      )}
                    </div>
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
    </div>
  );
}

