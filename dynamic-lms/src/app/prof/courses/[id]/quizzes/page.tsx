"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import CourseNavbar from "@/utils/CourseNavbar";
import { getCourseById, getCurrentProfessorId } from "@/lib/supabase/queries/courses.client";
import { useProfessorCourses } from "@/contexts/ProfessorCoursesContext";
import { getQuizzes, getQuestions, createQuestion, createQuiz, updateQuiz, setQuizQuestions, deleteQuiz } from "@/lib/supabase/queries/quizzes";
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
  const [monitoringQuizId, setMonitoringQuizId] = useState<string | null>(null);
  const [monitoringQuizName, setMonitoringQuizName] = useState<string>("");

  // Form state
  const [quizName, setQuizName] = useState("");
  const [quizType, setQuizType] = useState<"mixed" | "multiple_choice" | "true_false" | "fill_blank">("mixed");
  const [quizDueDate, setQuizDueDate] = useState("");
  const [quizMaxAttempts, setQuizMaxAttempts] = useState<string>("1");
  const [quizPointsPerQuestion, setQuizPointsPerQuestion] = useState<string>("10");
  const [generateQuestionType, setGenerateQuestionType] = useState<"multiple_choice" | "true_false" | "fill_blank">("multiple_choice");
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [quizBank, setQuizBank] = useState<Question[]>([]);
  const [filteredBank, setFilteredBank] = useState<Question[]>([]);

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
  const { handledCourses, createCourse } = useProfessorCourses();

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

      const question = await createQuestion({
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

      setQuizBank([...quizBank, transformedQuestion]);
      setFilteredBank([...filteredBank, transformedQuestion]);
      setSelectedQuestions([...selectedQuestions, transformedQuestion]);
      setCreateQuestionModalOpen(false);
      setSuccess("Question created and added to quiz!");
      setTimeout(() => setSuccess(""), 3000);

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
    setQuizName("");
    setQuizType("mixed");
    setQuizDueDate("");
    setQuizMaxAttempts("1");
    setSelectedQuestions([]);
    setRetakeRows([]);
    setRetakeLoading(false);
    setError("");
    setSuccess("");
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} onCreateCourse={createCourse} />
        <CourseNavbar courseId={courseId} currentPage="quizzes" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalQuizzes = quizzes.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Professor Navbar */}
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} onCreateCourse={createCourse} />

      {/* Course Navbar */}
      <CourseNavbar
        courseId={courseId}
        currentPage="quizzes"
        courseName={course?.name}
        courseCode={course?.code}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <Link
            href="/prof/courses"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Courses
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Quizzes
              </h1>
              <p className="text-gray-600">
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
                setSelectedQuestions([]);
                setCreateQuizModalOpen(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{quiz.name}</h3>
                    <p className="text-gray-600 text-sm">
                      Type: {quiz.type.replace("_", " ")} • {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setMonitoringQuizId(quiz.id);
                        setMonitoringQuizName(quiz.name);
                      }}
                      className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
                      className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleCancel}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {editingQuiz ? "Edit Quiz" : "Create Quiz"}
              </h2>
              <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Quiz Name and Type */}
                <div className="space-y-4 mb-6">
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white appearance-none cursor-pointer"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Used to compute total quiz score (points × number of items).
                    </p>
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">Set to blank for unlimited attempts.</p>
                  </div>
                </div>

                {/* Selected Questions Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Selected Questions ({selectedQuestions.length})</h3>
                    {selectedQuestions.length > 0 && (
                      <button
                        onClick={() => setSelectedQuestions([])}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
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
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedQuestions.map((question, index) => (
                        <div
                          key={question.id}
                          className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start justify-between"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">
                                {index + 1}
                              </span>
                              <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">
                                {question.type.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-gray-800 font-medium">{question.question}</p>
                            {question.source && (
                              <p className="text-xs text-gray-500 mt-1">
                                From: {question.sourceType === "lesson" ? "Lesson" : "PDF"}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleQuestionRemove(question.id)}
                            className="ml-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
                          <span>Loading retake data…</span>
                        </div>
                      </div>
                    ) : retakeRows.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
                        No students found for retake management.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {retakeRows.map((r) => (
                          <div
                            key={r.studentDbId}
                            className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{r.name}</p>
                              <p className="text-xs text-gray-600 truncate">{r.email}</p>
                              <p className="text-xs text-gray-500 mt-1">
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
                              className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
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

              {/* Quiz Bank Sidebar */}
              <div className="w-96 border-l border-gray-200 bg-gray-50 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 bg-white sticky top-0">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Quiz Bank</h3>
                    <button
                      onClick={() => setCreateQuestionModalOpen(true)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      + Create
                    </button>
                  </div>
                  <button
                    onClick={handleGenerateQuiz}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Generate More
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {filteredBank.length} question{filteredBank.length !== 1 ? "s" : ""} available
                  </p>
                </div>

                <div className="p-4 space-y-3">
                  {filteredBank.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No questions in quiz bank for this type.</p>
                      <button
                        onClick={() => setCreateQuestionModalOpen(true)}
                        className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                      >
                        Create one now
                      </button>
                    </div>
                  ) : (
                    filteredBank.map((question) => {
                      const isSelected = selectedQuestions.some((q) => q.id === question.id);
                      return (
                        <div
                          key={question.id}
                          className={`border rounded-xl p-4 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-100 border-indigo-300"
                              : "bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md"
                          }`}
                          onClick={() => !isSelected && handleQuestionSelect(question)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">
                              {question.type.replace("_", " ")}
                            </span>
                            {isSelected && (
                              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-800 mb-2">{question.question}</p>
                          {question.type === "multiple_choice" && question.options && (
                            <div className="mt-2 space-y-1">
                              {question.options.map((opt, idx) => (
                                <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                                  <span className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs">
                                    {String.fromCharCode(65 + idx)}
                                  </span>
                                  <span className={idx === question.correctAnswer ? "font-semibold text-green-600" : ""}>
                                    {opt}
                                  </span>
                                  {idx === question.correctAnswer && (
                                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            <p className="text-xs text-gray-600 mt-2">
                              Correct Answer: <span className="font-semibold">{question.correctAnswer ? "True" : "False"}</span>
                            </p>
                          )}
                          {question.type === "fill_blank" && (
                            <p className="text-xs text-gray-600 mt-2">
                              Answer: <span className="font-semibold">{question.correctAnswer as string}</span>
                            </p>
                          )}
                          {question.source && (
                            <p className="text-xs text-gray-500 mt-2">
                              From: {question.sourceType === "lesson" ? "Lesson" : "PDF"}
                            </p>
                          )}
                          {!isSelected && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuestionSelect(question);
                              }}
                              className="mt-3 w-full text-xs bg-indigo-600 text-white py-1.5 px-3 rounded-lg hover:bg-indigo-700 transition-colors"
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
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateQuiz}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  {editingQuiz ? "Save changes" : "Create Quiz"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Generate Quiz Modal */}
        {generateModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Generate Questions
                </h2>
                <button onClick={() => setGenerateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Question Type Selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Question Type</label>
                <select
                  value={generateQuestionType}
                  onChange={(e) => setGenerateQuestionType(e.target.value as "multiple_choice" | "true_false" | "fill_blank")}
                  disabled={generatingQuestions}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
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
                <div className="mb-4 p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-indigo-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-indigo-800 font-medium">Generating questions with Gemini…</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <p className="text-gray-600 mb-4">Select a lesson or PDF to generate questions from:</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lessons.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No lessons available. Create lessons first to generate questions.
                  </div>
                ) : (
                  lessons.map((lesson) => {
                    const isGenerating = generatingForSourceId === lesson.id;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => !generatingQuestions && handleGenerateFromSource(lesson.id, "lesson")}
                        disabled={generatingQuestions}
                        className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-gray-200"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-gray-800">{lesson.title}</div>
                          {isGenerating && (
                            <span className="shrink-0 flex items-center gap-1.5 text-indigo-600 text-sm font-medium">
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Create New Question
                </h2>
                <button onClick={() => setCreateQuestionModalOpen(false)} className="text-gray-400 hover:text-gray-600">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white resize-none"
                  />
                </div>

                {newQuestion.type === "multiple_choice" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Options</label>
                    <div className="space-y-2">
                      {newQuestion.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
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
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Source (Optional)</label>
                  <select
                    value={newQuestion.source}
                    onChange={(e) => setNewQuestion({ ...newQuestion, source: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
                  >
                    <option value="">None</option>
                    {lessons.map((lesson) => (
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

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCreateQuestionModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Create & Add to Quiz
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
