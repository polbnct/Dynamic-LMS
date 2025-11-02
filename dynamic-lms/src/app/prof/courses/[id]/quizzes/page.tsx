"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import CourseNavbar from "@/utils/CourseNavbar";
import { getCourseById, getCurrentProfessorId } from "@/lib/mockData/courses";

// Quiz question interfaces
type QuestionType = "multiple_choice" | "true_false" | "fill_blank" | "mixed";

interface BaseQuestion {
  id: string;
  type: QuestionType;
  question: string;
  source?: string; // lesson ID or PDF name
  sourceType?: "lesson" | "pdf";
  createdAt: string;
}

interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  options: string[];
  correctAnswer: number; // index of correct option
}

interface TrueFalseQuestion extends BaseQuestion {
  type: "true_false";
  correctAnswer: boolean;
}

interface FillBlankQuestion extends BaseQuestion {
  type: "fill_blank";
  correctAnswer: string;
}

interface Question extends BaseQuestion {
  options?: string[];
  correctAnswer: number | boolean | string;
}

// Mock lessons for reference
interface Lesson {
  id: string;
  title: string;
  pdfFileName?: string;
}

// Mock quiz bank questions
const MOCK_QUIZ_BANK: Question[] = [
  {
    id: "q1",
    type: "multiple_choice",
    question: "What is a set in discrete mathematics?",
    options: ["A collection of distinct objects", "A mathematical function", "A type of relation", "A graph structure"],
    correctAnswer: 0,
    source: "1",
    sourceType: "lesson",
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "q2",
    type: "multiple_choice",
    question: "Which operator is used for logical AND?",
    options: ["&&", "||", "!", "^"],
    correctAnswer: 0,
    source: "2",
    sourceType: "lesson",
    createdAt: "2024-01-20T10:00:00Z",
  },
  {
    id: "q3",
    type: "true_false",
    question: "A set can contain duplicate elements.",
    correctAnswer: false,
    source: "1",
    sourceType: "lesson",
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "q4",
    type: "true_false",
    question: "Propositional logic deals with statements that can be true or false.",
    correctAnswer: true,
    source: "2",
    sourceType: "lesson",
    createdAt: "2024-01-20T10:00:00Z",
  },
  {
    id: "q5",
    type: "fill_blank",
    question: "The union of sets A and B is denoted as ______.",
    correctAnswer: "A ∪ B",
    source: "3",
    sourceType: "lesson",
    createdAt: "2024-01-25T10:00:00Z",
  },
  {
    id: "q6",
    type: "fill_blank",
    question: "A function that maps every element to itself is called an ______ function.",
    correctAnswer: "identity",
    source: "4",
    sourceType: "lesson",
    createdAt: "2024-02-01T10:00:00Z",
  },
];

// Mock lessons
const MOCK_LESSONS: Lesson[] = [
  { id: "1", title: "Introduction to Discrete Structures", pdfFileName: "Introduction.pdf" },
  { id: "2", title: "Propositional Logic", pdfFileName: "Propositional_Logic.pdf" },
  { id: "3", title: "Set Theory Basics", pdfFileName: "Set_Theory.pdf" },
  { id: "4", title: "Relations and Functions", pdfFileName: "Relations_Functions.pdf" },
];

export default function QuizzesPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createQuizModalOpen, setCreateQuizModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [createQuestionModalOpen, setCreateQuestionModalOpen] = useState(false);

  // Form state
  const [quizName, setQuizName] = useState("");
  const [quizType, setQuizType] = useState<QuestionType>("mixed");
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [quizBank, setQuizBank] = useState<Question[]>(MOCK_QUIZ_BANK);
  const [filteredBank, setFilteredBank] = useState<Question[]>(MOCK_QUIZ_BANK);

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

  useEffect(() => {
    async function fetchCourse() {
      try {
        const courseData = await getCourseById(courseId);
        setCourse(courseData);
        setQuizzes([]);
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

  const handleGenerateFromSource = (sourceId: string, sourceType: "lesson" | "pdf") => {
    // Simulate generating questions from lesson/PDF
    const generatedQuestions: Question[] = [
      {
        id: `gen-${Date.now()}-1`,
        type: quizType === "mixed" ? "multiple_choice" : quizType,
        question: `Generated question from ${sourceType === "lesson" ? "lesson" : "PDF"}`,
        options: quizType === "multiple_choice" || quizType === "mixed" ? ["Option A", "Option B", "Option C", "Option D"] : undefined,
        correctAnswer: quizType === "multiple_choice" || quizType === "mixed" ? 0 : quizType === "true_false" ? true : "answer",
        source: sourceId,
        sourceType,
        createdAt: new Date().toISOString(),
      },
      {
        id: `gen-${Date.now()}-2`,
        type: quizType === "mixed" ? "true_false" : quizType,
        question: `Another generated question from ${sourceType === "lesson" ? "lesson" : "PDF"}`,
        correctAnswer: quizType === "true_false" || quizType === "mixed" ? false : quizType === "fill_blank" ? "answer" : 1,
        source: sourceId,
        sourceType,
        createdAt: new Date().toISOString(),
      },
    ];

    setQuizBank([...quizBank, ...generatedQuestions]);
    setGenerateModalOpen(false);
    setSuccess(`Generated ${generatedQuestions.length} questions!`);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleCreateQuestion = () => {
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

    const question: Question = {
      id: `q-${Date.now()}`,
      type: newQuestion.type,
      question: newQuestion.question.trim(),
      options: newQuestion.type === "multiple_choice" ? newQuestion.options : undefined,
      correctAnswer:
        newQuestion.type === "multiple_choice"
          ? newQuestion.correctAnswer
          : newQuestion.type === "true_false"
          ? newQuestion.trueFalseAnswer
          : newQuestion.fillBlankAnswer,
      source: newQuestion.source || undefined,
      sourceType: newQuestion.sourceType,
      createdAt: new Date().toISOString(),
    };

    setQuizBank([...quizBank, question]);
    setSelectedQuestions([...selectedQuestions, question]);
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
  };

  const handleCreateQuiz = () => {
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

    const quiz = {
      id: String(quizzes.length + 1),
      name: quizName.trim(),
      type: quizType,
      questions: selectedQuestions,
      createdAt: new Date().toISOString(),
    };

    setQuizzes([...quizzes, quiz]);
    setSuccess("Quiz created successfully!");

    // Reset form
    setQuizName("");
    setQuizType("mixed");
    setSelectedQuestions([]);

    setTimeout(() => {
      setCreateQuizModalOpen(false);
      setSuccess("");
    }, 1000);
  };

  const handleCancel = () => {
    setCreateQuizModalOpen(false);
    setGenerateModalOpen(false);
    setCreateQuestionModalOpen(false);
    setQuizName("");
    setQuizType("mixed");
    setSelectedQuestions([]);
    setError("");
    setSuccess("");
  };

  const handledCourses = course
    ? [
        {
          id: parseInt(course.id),
          name: course.name,
          code: course.code,
          studentsCount: course.studentsCount,
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />
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
      <ProfessorNavbar currentPage="courses" handledCourses={handledCourses} />

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
              onClick={() => setCreateQuizModalOpen(true)}
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
              <p className="text-gray-600 mb-6">Create your first quiz to get started</p>
              <button
                onClick={() => setCreateQuizModalOpen(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
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
                  <button className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Quiz Modal */}
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
                Create Quiz
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
                  Create Quiz
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
              <p className="text-gray-600 mb-4">Select a lesson or PDF to generate questions from:</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {MOCK_LESSONS.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => handleGenerateFromSource(lesson.id, "lesson")}
                    className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="font-semibold text-gray-800">{lesson.title}</div>
                    {lesson.pdfFileName && (
                      <div className="text-sm text-gray-500 mt-1">PDF: {lesson.pdfFileName}</div>
                    )}
                  </button>
                ))}
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
                    {MOCK_LESSONS.map((lesson) => (
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
    </div>
  );
}
