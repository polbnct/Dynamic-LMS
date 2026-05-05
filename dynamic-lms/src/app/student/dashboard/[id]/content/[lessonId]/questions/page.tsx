"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { getCourseById } from "@/lib/supabase/queries/courses.client";
import {
  getLessonStudyQuestions,
  submitStudyAidAttempt,
  type StudyAidQuestion,
} from "@/lib/supabase/queries/study-aid";
import { evaluateFillBlankAnswerByMode } from "@/lib/study-aid-symbols";
import { FillBlankModeTag, FillBlankSymbolBank } from "@/components/study/FillBlankSupport";
import {
  clearModuleAssessmentLock,
  isModuleAssessmentLockActive,
  readModuleAssessmentLock,
  writeModuleAssessmentLock,
} from "@/lib/module-assessment-lock";

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function isSummaryQuestion(q: StudyAidQuestion) {
  return (
    q.type === "summary" ||
    (q.type === "fill_blank" && String(q.correct_answer ?? "").toLowerCase().includes("summary"))
  );
}

interface CourseStudyAidSettings {
  name?: string;
  code?: string;
  shuffle_study_aid_questions?: boolean | null;
}

export default function StudentLessonQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const lessonId = params.lessonId as string;
  const { error: toastError, success: toastSuccess } = useToast();

  const [course, setCourse] = useState<CourseStudyAidSettings | null>(null);
  const [studyAidQuestions, setStudyAidQuestions] = useState<StudyAidQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [studyAidAnswers, setStudyAidAnswers] = useState<Record<string, number | string>>({});
  const [studyAidScoreSubmitted, setStudyAidScoreSubmitted] = useState(false);
  const [studyAidSubmitting, setStudyAidSubmitting] = useState(false);
  const [studyAidSubmitError, setStudyAidSubmitError] = useState<string | null>(null);
  const [isLockedByOtherTab, setIsLockedByOtherTab] = useState(false);
  const [showGoBack, setShowGoBack] = useState(false);
  const handleGoBack = () => {
  console.log("Go back clicked");
  setTimeout(() => {
    window.location.href = `/student/dashboard/${courseId}/content`;
  }, 100);
};
  const lockTabIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `assessment-tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const hasOwnershipRef = useRef(false);

  useEffect(() => {
    async function loadPageData() {
      setLoading(true);
      try {
        const [courseData, questions] = await Promise.all([
          getCourseById(courseId),
          getLessonStudyQuestions(lessonId),
        ]);
        setCourse(courseData);
        setStudyAidQuestions(questions);
      } catch (err) {
        console.error("Failed to load lesson questions:", err);
        toastError(err instanceof Error ? err.message : "Failed to load lesson questions.");
      } finally {
        setLoading(false);
      }
    }

    void loadPageData();
  }, [courseId, lessonId, toastError]);

  useEffect(() => {
    const tabId = lockTabIdRef.current;

    const acquireOrCheckLock = () => {
      const existing = readModuleAssessmentLock();
      if (
        existing &&
        isModuleAssessmentLockActive(existing) &&
        existing.ownerTabId !== tabId
      ) {
        hasOwnershipRef.current = false;
        setIsLockedByOtherTab(true);
        return false;
      }

      hasOwnershipRef.current = true;
      setIsLockedByOtherTab(false);
      writeModuleAssessmentLock({
        ownerTabId: tabId,
        courseId,
        lessonId,
        heartbeatAt: Date.now(),
      });
      return true;
    };

    acquireOrCheckLock();

    const heartbeat = window.setInterval(() => {
      if (!hasOwnershipRef.current || studyAidScoreSubmitted) return;
      writeModuleAssessmentLock({
        ownerTabId: tabId,
        courseId,
        lessonId,
        heartbeatAt: Date.now(),
      });
    }, 5000);

    const handleStorage = () => {
      const current = readModuleAssessmentLock();
      if (!current || !isModuleAssessmentLockActive(current)) {
        if (!studyAidScoreSubmitted) {
          acquireOrCheckLock();
        }
        return;
      }
      if (current.ownerTabId !== tabId) {
        hasOwnershipRef.current = false;
        setIsLockedByOtherTab(true);
      }
    };

    const handlePageHide = () => {
      clearModuleAssessmentLock(tabId);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      clearModuleAssessmentLock(tabId);
    };
  }, [courseId, lessonId, studyAidScoreSubmitted]);

  const shouldShuffleStudyAidQuestions =
    course?.shuffle_study_aid_questions === undefined || course?.shuffle_study_aid_questions === null
      ? true
      : Boolean(course.shuffle_study_aid_questions);

  const multipleChoiceQuestions = useMemo(() => {
    const list = studyAidQuestions.filter((q) => q.type === "multiple_choice");
    return shouldShuffleStudyAidQuestions ? shuffleArray(list) : list;
  }, [studyAidQuestions, shouldShuffleStudyAidQuestions]);

  const fillBlankQuestions = useMemo(() => {
    const list = studyAidQuestions.filter((q) => q.type === "fill_blank" && !isSummaryQuestion(q));
    return shouldShuffleStudyAidQuestions ? shuffleArray(list) : list;
  }, [studyAidQuestions, shouldShuffleStudyAidQuestions]);

  const questionCount = multipleChoiceQuestions.length + fillBlankQuestions.length;
  const multipleChoiceAnswered =
    multipleChoiceQuestions.length === 0 ||
    multipleChoiceQuestions.every((q) => studyAidAnswers[q.id] !== undefined);
  const fillBlankAnswered =
    fillBlankQuestions.length === 0 ||
    fillBlankQuestions.every((q) => (studyAidAnswers[q.id] ?? "").toString().trim() !== "");
  const allAnswered = multipleChoiceAnswered && fillBlankAnswered;

  const multipleChoiceScore = multipleChoiceQuestions.filter((q) => {
    const { answer: correct } = getStudyAidAnswerMeta(q.correct_answer);
    return Number(correct) === Number(studyAidAnswers[q.id]);
  }).length;
  const fillBlankScore = fillBlankQuestions.filter((q) => {
    const { answer: correct } = getStudyAidAnswerMeta(q.correct_answer);
    return evaluateFillBlankAnswerByMode(
      studyAidAnswers[q.id],
      correct,
      q.fill_blank_answer_mode ?? "term_only"
    );
  }).length;
  const score = multipleChoiceScore + fillBlankScore;
  const maxScore = questionCount;

  const handleSubmitAnswers = async () => {
    if (!allAnswered || studyAidSubmitting || maxScore === 0) return;
    setStudyAidSubmitting(true);
    setStudyAidSubmitError(null);

    try {
      const submissions: Array<{
        questionType: "multiple_choice" | "fill_blank";
        score: number;
        maxScore: number;
        answers?: Array<{
          student_answer: string;
          correct_answer: string;
          fill_blank_answer_mode?: "symbol_only" | "term_only" | null;
        }>;
      }> = [];

      if (multipleChoiceQuestions.length > 0) {
        submissions.push({
          questionType: "multiple_choice",
          score: multipleChoiceScore,
          maxScore: multipleChoiceQuestions.length,
        });
      }

      if (fillBlankQuestions.length > 0) {
        submissions.push({
          questionType: "fill_blank",
          score: fillBlankScore,
          maxScore: fillBlankQuestions.length,
          answers: fillBlankQuestions.map((q) => {
            const { answer: correct } = getStudyAidAnswerMeta(q.correct_answer);
            return {
              student_answer: String(studyAidAnswers[q.id] ?? ""),
              correct_answer: String(correct ?? ""),
              fill_blank_answer_mode: q.fill_blank_answer_mode ?? "term_only",
            };
          }),
        });
      }

      await Promise.all(
        submissions.map((submission) =>
          submitStudyAidAttempt(
            lessonId,
            submission.questionType,
            submission.score,
            submission.maxScore,
            submission.answers
          )
        )
      );

      setStudyAidScoreSubmitted(true);
      setShowGoBack(true);
      clearModuleAssessmentLock(lockTabIdRef.current);
      hasOwnershipRef.current = false;
      toastSuccess("Score saved. You can take again to improve.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save attempt";
      setStudyAidSubmitError(message);
      toastError(message);
    } finally {
      setStudyAidSubmitting(false);
    }
  };

  const shell = "min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50";
  const answeredCount = Object.keys(studyAidAnswers).length;

  return (
    <div className={`${shell} pb-28 sm:pb-24`}>
      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
            <p className="mt-4 text-sm font-medium text-gray-600">Loading assessment questions...</p>
          </div>
        ) : isLockedByOtherTab ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8 max-w-lg mx-auto text-center">
            <p className="text-lg font-semibold text-gray-800">Assessment is locked</p>
            <p className="mt-2 text-sm text-gray-600">
              You already have an assessment open in another tab. Close that tab to continue.
            </p>
          </div>
        ) : questionCount === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8 max-w-lg mx-auto text-center">
            <p className="text-lg font-semibold text-gray-800">No module assessment available</p>
            <p className="mt-2 text-sm text-gray-600">
              No professor-generated questions are available for this lesson yet.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 px-5 py-4 sm:px-6 sm:py-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                {answeredCount} / {questionCount}
              </p>
            </div>

            <div className="space-y-6">
              {multipleChoiceQuestions.map((question, qIndex) => (
                <div
                  key={question.id}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                >
                  {(() => {
                    const { answer: correct, correctExplanation, incorrectExplanation } =
                      getStudyAidAnswerMeta(question.correct_answer);
                    const selectedAnswer = studyAidAnswers[question.id];
                    const selectedIsCorrect = Number(correct) === Number(selectedAnswer);
                    return (
                      <>
                  <div className="mb-4">
                    <span className="text-sm font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                      Question {qIndex + 1}
                    </span>
                    <span className="ml-3 text-sm text-gray-500">Multiple Choice</span>
                  </div>
                  <h2 className="text-sm sm:text-lg font-semibold text-gray-800 mb-4">{question.question}</h2>

                  <div className="space-y-2">
                    {(question.options ?? []).map((option, idx) => {
                      const selected = studyAidAnswers[question.id] === idx;
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-2 p-2 sm:p-3 border rounded-lg cursor-pointer text-xs sm:text-base text-gray-800 transition-colors ${
                            selected ? "border-red-400 bg-red-50" : "border-gray-200 hover:bg-red-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`mc-${question.id}`}
                            checked={selected}
                            onChange={() => setStudyAidAnswers((prev) => ({ ...prev, [question.id]: idx }))}
                            disabled={studyAidScoreSubmitted}
                            className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-600 shrink-0 mt-1"
                          />
                          <span className="text-sm sm:text-base leading-snug sm:leading-relaxed">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                        {studyAidScoreSubmitted && (
                          <div className="mt-4 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-sm text-gray-700">
                              Correct answer:{" "}
                              <span className="font-semibold">
                                {(question.options ?? [])[Number(correct)] ?? String(correct)}
                              </span>
                            </p>
                            {(correctExplanation || incorrectExplanation) && (
                              <p className={`text-sm ${selectedIsCorrect ? "text-green-700" : "text-red-700"}`}>
                                {selectedIsCorrect ? correctExplanation : incorrectExplanation}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}

              {fillBlankQuestions.map((question, qIndex) => (
                <div
                  key={question.id}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                >
                  <div className="mb-4">
                    <span className="text-sm font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                      Question {multipleChoiceQuestions.length + qIndex + 1}
                    </span>
                    <span className="ml-3 text-sm text-gray-500">Fill in the blank</span>
                    <span className="ml-3">
                      <FillBlankModeTag mode={question.fill_blank_answer_mode} />
                    </span>
                  </div>
                  <h2 className="text-sm sm:text-lg font-semibold text-gray-800 mb-4">{question.question}</h2>
                  <input
                    type="text"
                    value={String(studyAidAnswers[question.id] ?? "")}
                    onChange={(e) => setStudyAidAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                    placeholder="Enter your answer"
                    disabled={studyAidScoreSubmitted}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <FillBlankSymbolBank
                    mode={question.fill_blank_answer_mode}
                    onInsert={(symbol) =>
                      setStudyAidAnswers((prev) => ({
                        ...prev,
                        [question.id]: `${String(prev[question.id] ?? "")}${symbol}`,
                      }))
                    }
                  />
                  {studyAidScoreSubmitted &&
                    (() => {
                      const { answer: correct, correctExplanation, incorrectExplanation } =
                        getStudyAidAnswerMeta(question.correct_answer);
                      const isCorrect = evaluateFillBlankAnswerByMode(
                        String(studyAidAnswers[question.id] ?? ""),
                        String(correct ?? ""),
                        question.fill_blank_answer_mode ?? "term_only"
                      );
                      return (
                        <div className="mt-4 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className={`text-sm font-medium ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                            {isCorrect ? "Correct!" : `Correct answer: ${String(correct ?? "")}`}
                          </p>
                          {(correctExplanation || incorrectExplanation) && (
                            <p className={`text-sm ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                              {isCorrect ? correctExplanation : incorrectExplanation}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {questionCount > 0 && !isLockedByOtherTab && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/90 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 sm:px-6 lg:px-8 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="order-2 text-center text-xs text-gray-500 sm:order-1 sm:max-w-md sm:text-left">
              {studyAidScoreSubmitted
                ? `Score saved: ${score} / ${maxScore} (${(maxScore ? (score / maxScore) * 100 : 0).toFixed(0)}%)`
                : "Answer all questions, then submit your module assessment."}
            </p>
            {!studyAidScoreSubmitted ? (
              <button
                type="button"
                onClick={handleSubmitAnswers}
                disabled={!allAnswered || studyAidSubmitting}
                className="order-1 w-full shrink-0 bg-red-600 py-3 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed sm:order-2 sm:w-auto sm:min-w-[220px] cursor-pointer"
              >
                {studyAidSubmitting ? "Submitting..." : "Submit all answers"}
              </button>
            ) : showGoBack ? (
              <button
                type="button"
                onClick={handleGoBack}
                className="order-1 w-full shrink-0 border border-slate-300 bg-white py-3 text-slate-700 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-slate-50 transition-all duration-200 sm:order-2 sm:w-auto sm:min-w-[220px] cursor-pointer"
              >
                Go Back to Lesson
              </button>
            ) : (
              <span className="order-1 inline-flex w-full items-center justify-center rounded-xl border border-green-200 bg-green-50 py-3 text-sm font-semibold text-green-700 sm:order-2 sm:w-auto sm:min-w-[220px]">
                Submitted
              </span>
            )}
          </div>
          {studyAidSubmitError && (
            <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 pb-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {studyAidSubmitError}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

