export interface StudyAidQuestion {
  id: string;
  // "summary" is treated as a separate, non-quiz-bank type for per-lesson summaries
  type: "multiple_choice" | "true_false" | "fill_blank" | "summary";
  question: string;
  options?: string[];
  correct_answer: number | boolean | string;
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

export async function addLessonStudyQuestions(
  lessonId: string,
  questions: Array<{
    type: "multiple_choice" | "true_false" | "fill_blank" | "summary";
    question: string;
    options?: string[];
    correct_answer: number | boolean | string;
  }>
): Promise<{ added: number }> {
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
  return { added: data.added ?? 0 };
}

export async function updateLessonStudyQuestion(
  lessonId: string,
  questionId: string,
  updates: {
    type?: "multiple_choice" | "true_false" | "fill_blank" | "summary";
    question?: string;
    options?: string[];
    correct_answer?: number | boolean | string;
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
  maxScore: number
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/lessons/${lessonId}/study-aid-attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionType, score, maxScore }),
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
