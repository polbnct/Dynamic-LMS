export type FillBlankAnswerMode = "symbol_only" | "term_only";

export interface StudyAidQuestion {
  id: string;
  // "summary" is treated as a separate, non-quiz-bank type for per-lesson summaries
  type: "multiple_choice" | "true_false" | "fill_blank" | "summary";
  question: string;
  options?: string[];
  correct_answer:
    | number
    | boolean
    | string
    | {
        answer: number | boolean | string;
        correct_explanation?: string;
        incorrect_explanation?: string;
      };
  fill_blank_answer_mode?: FillBlankAnswerMode | null;
}

export interface StudentLessonFlashcard {
  id: string;
  lesson_id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export async function getLessonStudyQuestions(
  lessonId: string
): Promise<StudyAidQuestion[]> {
  const res = await fetch(`/api/lessons/${lessonId}/study-questions`);
  if (!res.ok) {
    if (res.status === 500) return [];
    throw new Error("Failed to load study questions");
  }
  const data = await res.json();
  return data.questions ?? [];
}

export async function getStudentLessonFlashcards(
  lessonId: string
): Promise<StudentLessonFlashcard[]> {
  const res = await fetch(`/api/lessons/${lessonId}/student-flashcards`);
  if (!res.ok) {
    if (res.status === 500) return [];
    throw new Error("Failed to load your flashcards");
  }
  const data = await res.json();
  return data.flashcards ?? [];
}

export async function addStudentLessonFlashcard(
  lessonId: string,
  payload: { question: string; answer: string }
): Promise<StudentLessonFlashcard> {
  const res = await fetch(`/api/lessons/${lessonId}/student-flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create flashcard");
  }

  const data = await res.json();
  return data.flashcard;
}

export async function removeStudentLessonFlashcard(
  lessonId: string,
  flashcardId: string
): Promise<void> {
  const res = await fetch(
    `/api/lessons/${lessonId}/student-flashcards/${flashcardId}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete flashcard");
  }
}

export async function updateStudentLessonFlashcard(
  lessonId: string,
  flashcardId: string,
  payload: { question: string; answer: string }
): Promise<StudentLessonFlashcard> {
  const res = await fetch(
    `/api/lessons/${lessonId}/student-flashcards/${flashcardId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update flashcard");
  }

  const data = await res.json();
  return data.flashcard;
}

export async function addLessonStudyQuestions(
  lessonId: string,
  questions: Array<{
    type: "multiple_choice" | "true_false" | "fill_blank" | "summary";
    question: string;
    options?: string[];
    correct_answer:
      | number
      | boolean
      | string
      | {
          answer: number | boolean | string;
          correct_explanation?: string;
          incorrect_explanation?: string;
        };
    fill_blank_answer_mode?: FillBlankAnswerMode | null;
  }>
): Promise<{ added: number; skippedDuplicates: number }> {
  const res = await fetch(`/api/lessons/${lessonId}/study-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to add study questions");
  }
  const data = await res.json();
  return { added: data.added ?? 0, skippedDuplicates: data.skippedDuplicates ?? 0 };
}

export async function updateLessonStudyQuestion(
  lessonId: string,
  questionId: string,
  updates: {
    type?: "multiple_choice" | "true_false" | "fill_blank" | "summary";
    question?: string;
    options?: string[];
    correct_answer?:
      | number
      | boolean
      | string
      | {
          answer: number | boolean | string;
          correct_explanation?: string;
          incorrect_explanation?: string;
        };
    fill_blank_answer_mode?: FillBlankAnswerMode | null;
  }
): Promise<StudyAidQuestion> {
  const res = await fetch(
    `/api/lessons/${lessonId}/study-questions/${questionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update question");
  }
  const data = await res.json();
  return data.question;
}

export async function removeLessonStudyQuestion(
  lessonId: string,
  questionId: string
): Promise<void> {
  const res = await fetch(
    `/api/lessons/${lessonId}/study-questions/${questionId}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to remove question");
  }
}

export async function submitStudyAidAttempt(
  lessonId: string,
  questionType: "multiple_choice" | "fill_blank",
  score: number,
  maxScore: number,
  answers?: Array<{
    student_answer: string;
    correct_answer: string;
    fill_blank_answer_mode?: FillBlankAnswerMode | null;
  }>
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/lessons/${lessonId}/study-aid-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionType, score, maxScore, answers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save score");
  }
  return res.json();
}

export interface StudyAidAttempt {
  lesson_id: string;
  question_type: string;
  score: number;
  max_score: number;
  created_at: string;
}

export async function getStudyAidAttemptsForCourse(courseId: string): Promise<StudyAidAttempt[]> {
  const res = await fetch(`/api/courses/${courseId}/study-aid-attempts`);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return [];
    throw new Error("Failed to load study aid attempts");
  }
  const data = await res.json();
  return data.attempts ?? [];
}
