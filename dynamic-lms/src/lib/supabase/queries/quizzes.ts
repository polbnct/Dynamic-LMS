import { createClient } from "../client";

export interface Question {
  id: string;
  course_id?: string;
  professor_id: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
  question: string;
  options?: string[]; // JSON array for multiple choice
  correct_answer: string | number | boolean; // JSON
  source_lesson_id?: string;
  source_type?: "lesson" | "pdf";
  created_at: string;
}

export interface Quiz {
  id: string;
  course_id: string;
  name: string;
  type: "mixed" | "multiple_choice" | "true_false" | "fill_blank";
  time_limit?: number;
  due_date?: string;
  created_at: string;
}

export interface QuizQuestion {
  quiz_id: string;
  question_id: string;
  order: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  submitted_at?: string;
  score?: number;
  max_score: number;
}

export interface QuizAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: string | number | boolean; // JSON
  is_correct?: boolean;
}

// Get quizzes for a course
export async function getQuizzes(courseId: string): Promise<(Quiz & { questions: Question[] })[]> {
  const supabase = createClient();

  const { data: quizzes, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching quizzes:", error);
    throw error;
  }

  if (!quizzes || quizzes.length === 0) {
    return [];
  }

  // Get questions for each quiz
  const quizzesWithQuestions = await Promise.all(
    quizzes.map(async (quiz) => {
      const { data: quizQuestions } = await supabase
        .from("quiz_questions")
        .select("*, questions(*)")
        .eq("quiz_id", quiz.id)
        .order("order", { ascending: true });

      const questions = (quizQuestions || []).map((qq: any) => qq.questions).filter(Boolean);

      return {
        ...quiz,
        questions,
      };
    })
  );

  return quizzesWithQuestions;
}

// Get questions for a course or professor
export async function getQuestions(courseId?: string, professorId?: string): Promise<Question[]> {
  const supabase = createClient();

  let query = supabase.from("questions").select("*");

  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  if (professorId) {
    query = query.eq("professor_id", professorId);
  }

  query = query.order("created_at", { ascending: false });

  const { data: questions, error } = await query;

  if (error) {
    console.error("Error fetching questions:", error);
    throw error;
  }

  // Parse JSON fields
  return (questions || []).map((q) => ({
    ...q,
    options: q.options ? (typeof q.options === "string" ? JSON.parse(q.options) : q.options) : undefined,
    correct_answer:
      typeof q.correct_answer === "string" ? JSON.parse(q.correct_answer) : q.correct_answer,
  }));
}

// Create a question
export async function createQuestion(questionData: {
  course_id?: string;
  professor_id: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
  question: string;
  options?: string[];
  correct_answer: string | number | boolean;
  source_lesson_id?: string;
  source_type?: "lesson" | "pdf";
}): Promise<Question> {
  const supabase = createClient();

  const { data: question, error } = await supabase
    .from("questions")
    .insert({
      ...questionData,
      options: questionData.options ? JSON.stringify(questionData.options) : null,
      correct_answer: JSON.stringify(questionData.correct_answer),
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating question:", error);
    throw error;
  }

  return {
    ...question,
    options: question.options ? (typeof question.options === "string" ? JSON.parse(question.options) : question.options) : undefined,
    correct_answer: typeof question.correct_answer === "string" ? JSON.parse(question.correct_answer) : question.correct_answer,
  };
}

// Create a quiz
export async function createQuiz(
  courseId: string,
  quizData: {
    name: string;
    type: "mixed" | "multiple_choice" | "true_false" | "fill_blank";
    time_limit?: number;
    due_date?: string;
  },
  questionIds: string[]
): Promise<Quiz> {
  const supabase = createClient();

  // Create quiz
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      course_id: courseId,
      ...quizData,
    })
    .select()
    .single();

  if (quizError) {
    console.error("Error creating quiz:", quizError);
    throw quizError;
  }

  // Link questions
  if (questionIds.length > 0) {
    const quizQuestions = questionIds.map((questionId, index) => ({
      quiz_id: quiz.id,
      question_id: questionId,
      order: index + 1,
    }));

    const { error: linkError } = await supabase.from("quiz_questions").insert(quizQuestions);

    if (linkError) {
      console.error("Error linking questions:", linkError);
      throw linkError;
    }
  }

  return quiz;
}

// Start a quiz attempt
export async function startQuizAttempt(quizId: string, studentId: string): Promise<QuizAttempt> {
  const supabase = createClient();

  // Get quiz to determine max score
  const { data: quiz } = await supabase.from("quizzes").select("id").eq("id", quizId).single();
  const { count } = await supabase
    .from("quiz_questions")
    .select("*", { count: "exact", head: true })
    .eq("quiz_id", quizId);

  const { data: attempt, error } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      student_id: studentId,
      started_at: new Date().toISOString(),
      max_score: (count || 0) * 10, // Assuming 10 points per question
    })
    .select()
    .single();

  if (error) {
    console.error("Error starting quiz attempt:", error);
    throw error;
  }

  return attempt;
}

// Submit quiz answers
export async function submitQuizAnswers(
  attemptId: string,
  answers: { questionId: string; answer: string | number | boolean }[]
): Promise<{ score: number; maxScore: number }> {
  const supabase = createClient();

  // Get attempt to find questions
  const { data: attempt } = await supabase.from("quiz_attempts").select("*, quizzes(*)").eq("id", attemptId).single();

  if (!attempt) {
    throw new Error("Quiz attempt not found");
  }

  // Get questions and check answers
  const questionIds = answers.map((a) => a.questionId);
  const { data: questions } = await supabase.from("questions").select("*").in("id", questionIds);

  let correctCount = 0;

  const quizAnswers = answers.map((answer) => {
    const question = questions?.find((q) => q.id === answer.questionId);
    if (!question) return null;

    const correctAnswer =
      typeof question.correct_answer === "string"
        ? JSON.parse(question.correct_answer)
        : question.correct_answer;

    const isCorrect = JSON.stringify(answer.answer) === JSON.stringify(correctAnswer);
    if (isCorrect) correctCount++;

    return {
      attempt_id: attemptId,
      question_id: answer.questionId,
      answer: JSON.stringify(answer.answer),
      is_correct: isCorrect,
    };
  }).filter(Boolean);

  // Insert answers
  const { error: answerError } = await supabase.from("quiz_answers").insert(quizAnswers);

  if (answerError) {
    console.error("Error submitting answers:", answerError);
    throw answerError;
  }

  // Calculate score
  const score = (correctCount / answers.length) * attempt.max_score;

  // Update attempt
  await supabase
    .from("quiz_attempts")
    .update({
      score: Math.round(score),
      submitted_at: new Date().toISOString(),
    })
    .eq("id", attemptId);

  return { score: Math.round(score), maxScore: attempt.max_score };
}

// Get quiz results
export async function getQuizResults(quizId: string, studentId: string): Promise<QuizAttempt | null> {
  const supabase = createClient();

  const { data: attempt, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching quiz results:", error);
    return null;
  }

  return attempt;
}

