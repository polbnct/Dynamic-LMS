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
  type: "mixed" | "multiple_choice" | "true_false" | "fill_blank" | null;
  time_limit?: number;
  due_date?: string;
  max_attempts?: number | null;
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

      const rawQuestions = (quizQuestions || []).map((qq: any) => qq.questions).filter(Boolean);
      const questions = rawQuestions.map((q: any) => ({
        ...q,
        options: (() => {
          if (q?.options == null) return undefined;
          if (Array.isArray(q.options)) return q.options;
          if (typeof q.options === "string") {
            try {
              const parsed = JSON.parse(q.options);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        })(),
        correct_answer:
          q?.correct_answer != null
            ? typeof q.correct_answer === "string"
              ? (() => {
                  try {
                    return JSON.parse(q.correct_answer);
                  } catch {
                    return q.correct_answer;
                  }
                })()
              : q.correct_answer
            : undefined,
      }));

      return {
        ...quiz,
        // Convert null type to "mixed" for UI compatibility
        type: quiz.type === null ? "mixed" : quiz.type,
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
    max_attempts?: number | null;
  },
  questionIds: string[]
): Promise<Quiz> {
  // Validate inputs
  if (!courseId || typeof courseId !== "string" || courseId.trim() === "") {
    throw new Error("Invalid course ID provided");
  }
  
  if (!quizData || !quizData.name || quizData.name.trim() === "") {
    throw new Error("Quiz name is required");
  }
  
  if (!quizData.type) {
    throw new Error("Quiz type is required");
  }

  const supabase = createClient();

  // Prepare insert data
  // Note: "mixed" is not a valid enum value, so we set type to null for mixed quizzes
  // The database enum only supports: "multiple_choice", "true_false", "fill_blank"
  const insertData: any = {
    course_id: courseId.trim(),
    name: quizData.name.trim(),
    ...(quizData.time_limit && { time_limit: quizData.time_limit }),
    ...(quizData.due_date && { due_date: quizData.due_date }),
    ...(Object.prototype.hasOwnProperty.call(quizData, "max_attempts") && { max_attempts: quizData.max_attempts }),
  };

  // Only set type if it's not "mixed" (mixed quizzes have null type)
  if (quizData.type !== "mixed") {
    insertData.type = quizData.type;
  } else {
    insertData.type = null;
  }

  console.log("Attempting to create quiz with data:", JSON.stringify(insertData, null, 2));
  console.log("Course ID:", courseId);
  console.log("Quiz Data:", quizData);
  console.log("Question IDs to link:", questionIds);

  // Create quiz
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert(insertData)
    .select()
    .single();

  if (quizError) {
    // Try multiple ways to extract error information
    const errorMessage = 
      quizError.message || 
      (quizError as any).message || 
      String(quizError);
    
    const errorDetails = 
      quizError.details || 
      (quizError as any).details || 
      null;
    
    const errorHint = 
      quizError.hint || 
      (quizError as any).hint || 
      null;
    
    const errorCode = 
      quizError.code || 
      (quizError as any).code || 
      null;

    console.error("=== ERROR CREATING QUIZ ===");
    console.error("Error message:", errorMessage);
    console.error("Error details:", errorDetails);
    console.error("Error hint:", errorHint);
    console.error("Error code:", errorCode);
    console.error("Full error object:", quizError);
    console.error("Error type:", typeof quizError);
    console.error("Error constructor:", quizError?.constructor?.name);
    console.error("Quiz data that failed:", insertData);
    console.error("Question IDs to link:", questionIds);
    
    // Create a more informative error
    const informativeError = new Error(
      errorMessage || 
      errorDetails || 
      errorHint || 
      "Failed to create quiz. Check console for details."
    );
    (informativeError as any).originalError = quizError;
    (informativeError as any).details = errorDetails;
    (informativeError as any).hint = errorHint;
    (informativeError as any).code = errorCode;
    
    throw informativeError;
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
      // Extract all error properties (including non-enumerable ones)
      const errorInfo: any = {};
      for (const key in linkError) {
        errorInfo[key] = (linkError as any)[key];
      }
      const errorDetails = {
        message: linkError.message || errorInfo.message,
        details: linkError.details || errorInfo.details,
        hint: linkError.hint || errorInfo.hint,
        code: linkError.code || errorInfo.code,
        questionIds: questionIds,
        quizId: quiz.id,
        error: errorInfo,
      };
      console.error("Error linking questions:", errorDetails);
      throw linkError;
    }
  }

  // Convert null type to "mixed" for UI compatibility
  return {
    ...quiz,
    type: quiz.type === null ? "mixed" : quiz.type,
  };
}

// Update a quiz (name, type, time_limit, due_date). Pass due_date: null to clear.
export async function updateQuiz(
  quizId: string,
  updates: {
    name?: string;
    type?: "mixed" | "multiple_choice" | "true_false" | "fill_blank";
    time_limit?: number;
    due_date?: string | null;
    max_attempts?: number | null;
  }
): Promise<Quiz> {
  const supabase = createClient();
  const dbType = updates.type === "mixed" ? null : updates.type;
  const { data, error } = await supabase
    .from("quizzes")
    .update({
      ...(updates.name != null && { name: updates.name }),
      ...(updates.type != null && { type: dbType }),
      ...(updates.time_limit != null && { time_limit: updates.time_limit }),
      ...(Object.prototype.hasOwnProperty.call(updates, "due_date") && { due_date: updates.due_date ?? null }),
      ...(Object.prototype.hasOwnProperty.call(updates, "max_attempts") && { max_attempts: updates.max_attempts ?? null }),
    })
    .eq("id", quizId)
    .select()
    .single();

  if (error) {
    console.error("Error updating quiz:", error);
    throw error;
  }
  return { ...data, type: data.type === null ? "mixed" : data.type };
}

// Set which questions are in a quiz (replaces existing)
export async function setQuizQuestions(quizId: string, questionIds: string[]): Promise<void> {
  const supabase = createClient();
  const { error: delError } = await supabase.from("quiz_questions").delete().eq("quiz_id", quizId);
  if (delError) {
    console.error("Error removing quiz questions:", delError);
    throw delError;
  }
  if (questionIds.length > 0) {
    const rows = questionIds.map((questionId, index) => ({
      quiz_id: quizId,
      question_id: questionId,
      order: index + 1,
    }));
    const { error: insertError } = await supabase.from("quiz_questions").insert(rows);
    if (insertError) {
      console.error("Error adding quiz questions:", insertError);
      throw insertError;
    }
  }
}

// Start a quiz attempt
export async function startQuizAttempt(quizId: string, studentId: string): Promise<QuizAttempt> {
  const supabase = createClient();

  // If there is already an in-progress attempt for this student/quiz, reuse it.
  // This avoids duplicate attempts in dev (React Strict Mode) and on refresh.
  const { data: existingAttempt } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("student_id", studentId)
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingAttempt) {
    return {
      ...existingAttempt,
      score: existingAttempt.score != null ? Number(existingAttempt.score) : 0,
      max_score: existingAttempt.max_score != null ? Number(existingAttempt.max_score) : 0,
    };
  }

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

// Get quiz results (latest submitted attempt only; in-progress attempts have null submitted_at)
export async function getQuizResults(quizId: string, studentId: string): Promise<QuizAttempt | null> {
  const supabase = createClient();

  const { data: attempt, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("student_id", studentId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching quiz results:", error);
    return null;
  }

  if (!attempt) return null;

  // Normalize so score/max_score are always present (Supabase may return snake_case)
  return {
    ...attempt,
    score: attempt.score != null ? Number(attempt.score) : 0,
    max_score: attempt.max_score != null ? Number(attempt.max_score) : 0,
  };
}

export interface QuizResultAnswer {
  questionId: string;
  questionText: string;
  questionType: string;
  options?: string[];
  correctAnswer: number | boolean | string;
  userAnswer: string | number | boolean;
  isCorrect: boolean;
}

export interface QuizResultWithAnswers {
  attempt: QuizAttempt;
  answers: QuizResultAnswer[];
}

// Get attempt with answers and question details for showing results
export async function getQuizAttemptWithAnswers(attemptId: string): Promise<QuizResultWithAnswers | null> {
  const supabase = createClient();

  const { data: attempt, error: attemptErr } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (attemptErr || !attempt) return null;

  const { data: answersRows, error: answersErr } = await supabase
    .from("quiz_answers")
    .select("*, questions(*)")
    .eq("attempt_id", attemptId);

  if (answersErr || !answersRows?.length) {
    return {
      attempt: {
        ...attempt,
        score: attempt.score != null ? Number(attempt.score) : 0,
        max_score: attempt.max_score != null ? Number(attempt.max_score) : 0,
      },
      answers: [],
    };
  }

  const { data: quizQuestions } = await supabase
    .from("quiz_questions")
    .select("question_id, order")
    .eq("quiz_id", attempt.quiz_id)
    .order("order", { ascending: true });

  const orderMap = new Map((quizQuestions || []).map((r: any) => [r.question_id, r.order ?? 999]));
  const sorted = [...answersRows].sort(
    (a: any, b: any) => (orderMap.get(a.question_id) ?? 999) - (orderMap.get(b.question_id) ?? 999)
  );

  const parseAnswer = (val: unknown): string | number | boolean => {
    if (typeof val === "string") {
      try {
        const p = JSON.parse(val);
        return typeof p === "boolean" ? p : typeof p === "number" ? p : String(p);
      } catch {
        return val;
      }
    }
    return val as string | number | boolean;
  };

  const formatCorrectAnswer = (q: any, correctVal: unknown): string | number | boolean => {
    if (q.type === "multiple_choice" && q.options) {
      const opts = typeof q.options === "string" ? JSON.parse(q.options || "[]") : q.options;
      const idx = typeof correctVal === "number" ? correctVal : parseInt(String(correctVal), 10);
      return opts[idx] ?? correctVal;
    }
    return correctVal as string | number | boolean;
  };

  const answers: QuizResultAnswer[] = sorted.map((row: any) => {
    const q = row.questions || {};
    const correctRaw =
      typeof q.correct_answer === "string" ? JSON.parse(q.correct_answer || "null") : q.correct_answer;
    const options =
      q.options != null
        ? Array.isArray(q.options)
          ? q.options
          : (() => {
              try {
                return JSON.parse(q.options);
              } catch {
                return [];
              }
            })()
        : undefined;
    return {
      questionId: row.question_id,
      questionText: q.question || "",
      questionType: q.type || "multiple_choice",
      options,
      correctAnswer: correctRaw,
      userAnswer: parseAnswer(row.answer),
      isCorrect: Boolean(row.is_correct),
    };
  });

  return {
    attempt: {
      ...attempt,
      score: attempt.score != null ? Number(attempt.score) : 0,
      max_score: attempt.max_score != null ? Number(attempt.max_score) : 0,
    },
    answers,
  };
}

