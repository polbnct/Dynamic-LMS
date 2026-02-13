"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import CourseNavbar from "@/utils/CourseNavbar";
import { getCourseById } from "@/lib/supabase/queries/courses.client";
import { getLessons, createLesson, deleteLesson, uploadLessonPDF, getLessonPDFUrl } from "@/lib/supabase/queries/lessons";
import type { Lesson } from "@/lib/supabase/queries/lessons";
import {
  getLessonStudyQuestions,
  addLessonStudyQuestions,
  removeLessonStudyQuestion,
  updateLessonStudyQuestion,
  type StudyAidQuestion,
} from "@/lib/supabase/queries/study-aid";

function EditStudyQuestionForm({
  question,
  onSave,
  onCancel,
  saving,
}: {
  question: StudyAidQuestion;
  onSave: (updates: {
    type?: "multiple_choice" | "true_false" | "fill_blank";
    question?: string;
    options?: string[];
    correct_answer?: number | boolean | string;
  }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [questionText, setQuestionText] = useState(question.question);
  const [type, setType] = useState<"multiple_choice" | "true_false" | "fill_blank">(question.type);
  const [options, setOptions] = useState<string[]>(
    question.type === "multiple_choice" && question.options?.length
      ? question.options
      : ["", "", "", ""]
  );
  const [correctAnswerMc, setCorrectAnswerMc] = useState(
    question.type === "multiple_choice" ? Number(question.correct_answer) : 0
  );
  const [correctAnswerTf, setCorrectAnswerTf] = useState(
    question.type === "true_false" ? Boolean(question.correct_answer) : true
  );
  const [correctAnswerFill, setCorrectAnswerFill] = useState(
    question.type === "fill_blank" ? String(question.correct_answer) : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "multiple_choice") {
      const opts = options.map((o) => o.trim() || "");
      await onSave({
        question: questionText.trim(),
        type,
        options: opts.some((o) => o) ? opts : ["Option A", "Option B", "Option C", "Option D"],
        correct_answer: correctAnswerMc,
      });
    } else if (type === "true_false") {
      await onSave({ question: questionText.trim(), type, correct_answer: correctAnswerTf });
    } else {
      await onSave({
        question: questionText.trim(),
        type,
        correct_answer: correctAnswerFill.trim() || " ",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Question text
        </label>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm min-h-[88px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
          placeholder="Enter the question..."
          required
        />
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Question type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "multiple_choice" | "true_false" | "fill_blank")}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          >
            <option value="multiple_choice">Multiple choice</option>
            <option value="true_false">Flashcard</option>
            <option value="fill_blank">Summary</option>
          </select>
      </div>
      {type === "multiple_choice" && (
        <>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Answer options</label>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold">
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
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Correct answer</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCorrectAnswerTf(true)}
              className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                correctAnswerTf ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              True
            </button>
            <button
              type="button"
              onClick={() => setCorrectAnswerTf(false)}
              className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                !correctAnswerTf ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              False
            </button>
          </div>
        </div>
      )}
      {type === "fill_blank" && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">Correct answer</label>
          <input
            type="text"
            value={correctAnswerFill}
            onChange={(e) => setCorrectAnswerFill(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Answer that fills the blank"
          />
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
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
          className="px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
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
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLessonModalOpen, setAddLessonModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "prelim" as "prelim" | "midterm" | "finals",
    pdfFile: null as File | null,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [studyAidLesson, setStudyAidLesson] = useState<Lesson | null>(null);
  const [studyAidQuestions, setStudyAidQuestions] = useState<StudyAidQuestion[]>([]);
  const [generatedForStudy, setGeneratedForStudy] = useState<any[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<number>>(new Set());
  const [studyAidGenerateType, setStudyAidGenerateType] = useState<"summary" | "flashcard" | "multiple_choice">("multiple_choice");
  const [studyAidGenerateCount, setStudyAidGenerateCount] = useState(5);
  const [studyAidLoading, setStudyAidLoading] = useState(false);
  const [studyAidGenerating, setStudyAidGenerating] = useState(false);
  const [studyAidAdding, setStudyAidAdding] = useState(false);
  const [editingStudyQuestion, setEditingStudyQuestion] = useState<StudyAidQuestion | null>(null);
  const [studyAidSaving, setStudyAidSaving] = useState(false);

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

    try {
      // Upload PDF first
      const tempLessonId = `temp-${Date.now()}`;
      const pdfPath = await uploadLessonPDF(formData.pdfFile, courseId, tempLessonId);

      // Calculate order
      const categoryLessons = lessons.filter((l) => l.category === formData.category);
      const order = categoryLessons.length + 1;

      // Create lesson in database
      const newLesson = await createLesson(courseId, {
        title: formData.title.trim(),
        category: formData.category,
        pdf_file_path: pdfPath,
        order,
      });

      // Add to local state
      setLessons([
        ...lessons,
        {
          ...newLesson,
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
        <CourseNavbar courseId={courseId} currentPage="content" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  const totalLessons = lessons.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
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
                Course Content
              </h1>
              <p className="text-gray-600">
                {course?.name} ({course?.code}) • {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => setAddLessonModalOpen(true)}
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
              Add Lesson
            </button>
          </div>
        </div>

        {/* Lessons by Category */}
        {totalLessons === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                Add Lesson
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {(["prelim", "midterm", "finals"] as const).map((category) => {
              const categoryLessons = lessonsByCategory[category];
              if (categoryLessons.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800">{categoryLabels[category]}</h2>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                      {categoryLessons.length} lesson{categoryLessons.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Lessons in Category */}
                  <div className="space-y-4">
                    {categoryLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-800 mb-2">{lesson.title}</h3>
                              {lesson.description && (
                                <p className="text-gray-600 mb-3">{lesson.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                {lesson.pdfFileName && (
                                  <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                    <span>{lesson.pdfFileName}</span>
                                  </div>
                                )}
                                <span>
                                  Created: {new Date(lesson.createdAt).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {lesson.pdf_file_path && (
                              <button
                                type="button"
                                onClick={async () => {
                                  setStudyAidLesson(lesson);
                                  setError("");
                                  setSuccess("");
                                  setEditingStudyQuestion(null);
                                  setGeneratedForStudy([]);
                                  setSelectedGenerated(new Set());
                                  setStudyAidLoading(true);
                                  try {
                                    const list = await getLessonStudyQuestions(lesson.id);
                                    setStudyAidQuestions(list);
                                  } catch (e) {
                                    setStudyAidQuestions([]);
                                  } finally {
                                    setStudyAidLoading(false);
                                  }
                                }}
                                className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Manage study aid questions"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </button>
                            )}
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
                            <button className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

      {/* Manage Study Aid Modal */}
      {studyAidLesson && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setStudyAidLesson(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header with gradient */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Study aid</h2>
                    <p className="text-indigo-100 text-sm mt-0.5">{studyAidLesson.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStudyAidLesson(null)}
                  className="p-2 rounded-xl hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              )}

              {/* Current study aid — card */}
              <section className="rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 bg-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800">Your study aid questions</h3>
                  {studyAidQuestions.length > 0 && (
                    <span className="ml-auto text-sm font-medium text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                      {studyAidQuestions.length} question{studyAidQuestions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  {studyAidLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                      <svg className="animate-spin w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading…
                    </div>
                  ) : studyAidQuestions.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 rounded-2xl bg-gray-200 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">No questions yet</p>
                      <p className="text-gray-500 text-sm mt-1">Generate questions below and add them here.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {studyAidQuestions.map((q) => (
                        <li
                          key={q.id}
                          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all"
                        >
                          <span className="flex-1 text-sm text-gray-800 line-clamp-2 pr-2">{q.question}</span>
                          <span className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
                            {q.type === "true_false" ? "Flashcard" : q.type === "fill_blank" ? "Summary" : "Multiple choice"}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingStudyQuestion(q)}
                              className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await removeLessonStudyQuestion(studyAidLesson.id, q.id);
                                  setStudyAidQuestions((prev) => prev.filter((x) => x.id !== q.id));
                                  if (editingStudyQuestion?.id === q.id) setEditingStudyQuestion(null);
                                } catch (e) {
                                  setError((e as Error).message);
                                }
                              }}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {editingStudyQuestion && studyAidLesson && (
                    <div className="mt-5 rounded-2xl border-2 border-indigo-200 bg-white p-5 shadow-sm">
                      <h4 className="flex items-center gap-2 font-semibold text-gray-800 mb-4">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit question
                      </h4>
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
                            setStudyAidQuestions((prev) =>
                              prev.map((x) => (x.id === updated.id ? updated : x))
                            );
                            setEditingStudyQuestion(updated);
                            setSuccess("Question updated.");
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
              </section>

              {/* Generate with AI — card */}
              <section className="rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 bg-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800">Generate with AI (Gemini)</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Question type</label>
                      <select
                        value={studyAidGenerateType}
                        onChange={(e) => {
                          setStudyAidGenerateType(e.target.value as any);
                          if (e.target.value === "summary") {
                            setStudyAidGenerateCount(1);
                          }
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="summary">Summary (1 per lesson)</option>
                        <option value="flashcard">Flashcard</option>
                        <option value="multiple_choice">Multiple choice</option>
                      </select>
                    </div>
                    {studyAidGenerateType !== "summary" && (
                      <div className="w-24">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Count</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={studyAidGenerateCount}
                          onChange={(e) => setStudyAidGenerateCount(parseInt(e.target.value, 10) || 5)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    )}
                    {studyAidGenerateType === "summary" && (
                      <div className="w-24">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Count</label>
                        <div className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-gray-500">
                          1 (Summary only)
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={studyAidGenerating}
                      onClick={async () => {
                        // Check if summary already exists
                        if (studyAidGenerateType === "summary") {
                          const existingSummary = studyAidQuestions.find((q) => q.type === "fill_blank");
                          if (existingSummary) {
                            if (!confirm("A summary already exists for this lesson. Generating a new one will replace it. Continue?")) {
                              return;
                            }
                          }
                        }
                        setStudyAidGenerating(true);
                        setError("");
                        try {
                          const res = await fetch("/api/gemini/generate-questions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            lessonId: studyAidLesson.id,
                            questionType: studyAidGenerateType === "summary" ? "fill_blank" : studyAidGenerateType === "flashcard" ? "true_false" : "multiple_choice",
                            count: studyAidGenerateType === "summary" ? 1 : studyAidGenerateCount,
                            forStudyAid: true,
                          }),
                          });
                          if (!res.ok) {
                            const d = await res.json().catch(() => ({}));
                            throw new Error(d.error || "Generate failed");
                          }
                          const data = await res.json();
                          setGeneratedForStudy(data.questions || []);
                          setSelectedGenerated(new Set((data.questions || []).map((_: any, i: number) => i)));
                        } catch (e) {
                          setError((e as Error).message);
                          setGeneratedForStudy([]);
                        } finally {
                          setStudyAidGenerating(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
                    >
                      {studyAidGenerating ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Generate
                        </>
                      )}
                    </button>
                  </div>

                  {generatedForStudy.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Select questions to add</span>
                        <span className="text-xs text-gray-500">{selectedGenerated.size} selected</span>
                      </div>
                      <ul className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                        {generatedForStudy.map((q: any, idx: number) => (
                          <li
                            key={idx}
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                              selectedGenerated.has(idx) ? "bg-indigo-50/80" : "hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              setSelectedGenerated((prev) => {
                                const next = new Set(prev);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                return next;
                              });
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedGenerated.has(idx)}
                              onChange={() => {}}
                              className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-800 flex-1">{q.question}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                        <button
                          type="button"
                          disabled={studyAidAdding || selectedGenerated.size === 0}
                          onClick={async () => {
                            const toAdd = generatedForStudy.filter((_, i) => selectedGenerated.has(i));
                            if (toAdd.length === 0) return;
                            setStudyAidAdding(true);
                            setError("");
                            try {
                              // If adding a summary, remove existing summary first
                              if (studyAidGenerateType === "summary") {
                                const existingSummary = studyAidQuestions.find((q) => q.type === "fill_blank");
                                if (existingSummary) {
                                  try {
                                    await removeLessonStudyQuestion(studyAidLesson.id, existingSummary.id);
                                  } catch (e) {
                                    console.error("Error removing existing summary:", e);
                                  }
                                }
                              }
                              const payload = toAdd.map((q: any) => ({
                                type: q.type,
                                question: q.question,
                                options: q.options,
                                correct_answer: q.correct_answer,
                              }));
                              const { added } = await addLessonStudyQuestions(studyAidLesson.id, payload);
                              const list = await getLessonStudyQuestions(studyAidLesson.id);
                              setStudyAidQuestions(list);
                              setGeneratedForStudy([]);
                              setSelectedGenerated(new Set());
                              setSuccess(`Added ${added} ${studyAidGenerateType === "summary" ? "summary" : "question(s)"} to study aid.`);
                              setTimeout(() => setSuccess(""), 3000);
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setStudyAidAdding(false);
                            }
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {studyAidAdding ? (
                            <>
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Adding…
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Add {selectedGenerated.size} question{selectedGenerated.size !== 1 ? "s" : ""} to study aid
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {addLessonModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCancel}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Add New Lesson
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
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
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter lesson name"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white"
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
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white appearance-none cursor-pointer"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                  {formData.pdfFile && (
                    <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-red-600 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
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

                {/* Success Message */}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-green-600 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
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

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Add Lesson
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
