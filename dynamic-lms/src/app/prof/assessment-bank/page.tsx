"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import ProfessorNavbar from "@/utils/ProfessorNavbar";
import { getCurrentProfessorId } from "@/lib/supabase/queries/courses.client";
import { getQuestions } from "@/lib/supabase/queries/quizzes";
import type { Question } from "@/lib/supabase/queries/quizzes";

export default function AssessmentBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const professorId = await getCurrentProfessorId(true);
        if (!professorId) {
          throw new Error("Professor not found");
        }

        const questionsData = await getQuestions(undefined, professorId);
        setQuestions(questionsData);
      } catch (err) {
        console.error("Error fetching questions:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, []);

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    if (filterCourse !== "all" && q.course_id !== filterCourse) return false;
    if (filterType !== "all" && q.type !== filterType) return false;
    if (searchQuery && !q.question.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const typeLabels = {
    multiple_choice: "Multiple Choice",
    true_false: "True/False",
    fill_blank: "Fill in the Blank",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <ProfessorNavbar currentPage="assessment-bank" handledCourses={[]} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <ProfessorNavbar currentPage="assessment-bank" handledCourses={[]} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Assessment Bank
          </h1>
          <p className="text-gray-600">Manage your question bank across all courses</p>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions..."
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Question Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True/False</option>
                <option value="fill_blank">Fill in the Blank</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Courses</option>
                {/* Course options would be populated from courses */}
              </select>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-600">No questions found</p>
            </div>
          ) : (
            filteredQuestions.map((question) => (
              <div
                key={question.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                        {typeLabels[question.type]}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{question.question}</h3>
                    {question.type === "multiple_choice" && question.options && (
                      <div className="mt-2 space-y-1">
                        {question.options.map((opt, idx) => (
                          <div key={idx} className="text-sm text-gray-600">
                            {String.fromCharCode(65 + idx)}. {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Created: {new Date(question.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
