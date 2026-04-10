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
  category?: "prelim" | "midterm" | "finals";
  time_limit?: number;
  due_date?: string;
  max_attempts?: number | null;
  points_per_question?: number;
  reveal_correct_answers?: boolean;
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

// Get questions for a course or professor.
// By default, excludes questions that are only used for lesson study aids (linked via lesson_study_questions),
// so study-aid content does not pollute the quiz/assessment question bank.
export async function getQuestions(
  courseId?: string,
  professorId?: string,
  options?: { includeStudyAid?: boolean }
): Promise<Question[]> {
  const supabase = createClient();

  const includeStudyAid = options?.includeStudyAid ?? false;

  // When excluding study-aid questions, we fetch the IDs that are linked in lesson_study_questions
  // and filter them out client-side. This avoids schema changes while keeping separation of concerns.
  let studyAidQuestionIds: Set<string> | null = null;
  if (!includeStudyAid) {
    const { data: links, error: linksError } = await supabase
      .from("lesson_study_questions")
      .select("question_id");
    if (!linksError && links) {
      studyAidQuestionIds = new Set(links.map((l: any) => l.question_id));
    }
  }

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

  // Parse JSON fields and optionally filter out study-aid-only questions
  const parsed = (questions || []).map((q) => ({
    ...q,
    options: q.options ? (typeof q.options === "string" ? JSON.parse(q.options) : q.options) : undefined,
    correct_answer:
      typeof q.correct_answer === "string" ? JSON.parse(q.correct_answer) : q.correct_answer,
  }));

  if (!includeStudyAid && studyAidQuestionIds) {
    return parsed.filter((q) => !studyAidQuestionIds!.has(q.id));
  }

  return parsed;
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

// Update a question
export async function updateQuestion(
  questionId: string,
  updates: {
    type?: "multiple_choice" | "true_false" | "fill_blank";
    question?: string;
    options?: string[] | null;
    correct_answer?: string | number | boolean;
    source_lesson_id?: string | null;
    source_type?: "lesson" | "pdf" | null;
  }
): Promise<Question> {
  const supabase = createClient();

  const payload: any = {};
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.question !== undefined) payload.question = updates.question;
  if (Object.prototype.hasOwnProperty.call(updates, "options")) {
    payload.options = updates.options ? JSON.stringify(updates.options) : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "correct_answer")) {
    payload.correct_answer = JSON.stringify(updates.correct_answer);
  }
  if (Object.prototype.hasOwnProperty.call(updates, "source_lesson_id")) {
    payload.source_lesson_id = updates.source_lesson_id ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "source_type")) {
    payload.source_type = updates.source_type ?? null;
  }

  const { data: question, error } = await supabase
    .from("questions")
    .update(payload)
    .eq("id", questionId)
    .select()
    .single();

  if (error) {
    console.error("Error updating question:", error);
    throw error;
  }

  return {
    ...question,
    options: question.options
      ? typeof question.options === "string"
        ? JSON.parse(question.options)
        : question.options
      : undefined,
    correct_answer:
      typeof question.correct_answer === "string"
        ? JSON.parse(question.correct_answer)
        : question.correct_answer,
  };
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const supabase = createClient();

  // Ensure the question is not linked to any quizzes.
  const { error: qqError } = await supabase
    .from("quiz_questions")
    .delete()
    .eq("question_id", questionId);
  if (qqError) {
    console.error("Error unlinking quiz question:", qqError);
    throw qqError;
  }

  // Delete any study-aid associations (if present).
  const { error: saError } = await supabase
    .from("lesson_study_questions")
    .delete()
    .eq("question_id", questionId);
  if (saError) {
    console.error("Error removing study-aid question link:", saError);
    throw saError;
  }

  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  if (error) {
    console.error("Error deleting question:", error);
    throw error;
  }
}

// Create a quiz
export async function createQuiz(
  courseId: string,
  quizData: {
    name: string;
    type: "mixed" | "multiple_choice" | "true_false" | "fill_blank";
    category?: "prelim" | "midterm" | "finals";
    time_limit?: number;
    due_date?: string;
    max_attempts?: number | null;
    points_per_question?: number | null;
    reveal_correct_answers?: boolean;
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
    ...(quizData.category && { category: quizData.category }),
    ...(quizData.time_limit && { time_limit: quizData.time_limit }),
    ...(quizData.due_date && { due_date: quizData.due_date }),
    ...(Object.prototype.hasOwnProperty.call(quizData, "max_attempts") && {
      max_attempts: quizData.max_attempts,
    }),
    // Default points per question to 10 if not provided
    points_per_question:
      quizData.points_per_question != null && !Number.isNaN(quizData.points_per_question)
        ? Number(quizData.points_per_question)
        : 10,
  };

  // Only include the reveal setting if the caller explicitly provided it.
  // This prevents runtime failures if the DB migration hasn't been applied yet.
  if (quizData.reveal_correct_answers !== undefined) {
    insertData.reveal_correct_answers = Boolean(quizData.reveal_correct_answers);
  }

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
    category?: "prelim" | "midterm" | "finals";
    time_limit?: number;
    due_date?: string | null;
    max_attempts?: number | null;
    points_per_question?: number | null;
    reveal_correct_answers?: boolean;
  }
): Promise<Quiz> {
  const supabase = createClient();
  const dbType = updates.type === "mixed" ? null : updates.type;
  const { data, error } = await supabase
    .from("quizzes")
    .update({
      ...(updates.name != null && { name: updates.name }),
      ...(updates.type != null && { type: dbType }),
      ...(updates.category != null && { category: updates.category }),
      ...(updates.time_limit != null && { time_limit: updates.time_limit }),
      ...(Object.prototype.hasOwnProperty.call(updates, "due_date") && { due_date: updates.due_date ?? null }),
      ...(Object.prototype.hasOwnProperty.call(updates, "max_attempts") && {
        max_attempts: updates.max_attempts ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(updates, "points_per_question") && {
        points_per_question:
          updates.points_per_question != null && !Number.isNaN(updates.points_per_question)
            ? Number(updates.points_per_question)
            : 10,
      }),
      ...(Object.prototype.hasOwnProperty.call(updates, "reveal_correct_answers") && {
        reveal_correct_answers: Boolean(updates.reveal_correct_answers),
      }),
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

  const normalizeComparableAnswer = (val: unknown): string | number | boolean => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "true") return true;
      if (trimmed === "false") return false;
      if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
      return trimmed;
    }
    return val as string | number | boolean;
  };

  let correctCount = 0;

  const quizAnswers = answers.map((answer) => {
    const question = questions?.find((q) => q.id === answer.questionId);
    if (!question) return null;

    const correctAnswer =
      typeof question.correct_answer === "string"
        ? JSON.parse(question.correct_answer)
        : question.correct_answer;

    const normalizedStudentAnswer = normalizeComparableAnswer(answer.answer);
    const normalizedCorrectAnswer = normalizeComparableAnswer(correctAnswer);
    const isCorrect = JSON.stringify(normalizedStudentAnswer) === JSON.stringify(normalizedCorrectAnswer);
    if (isCorrect) correctCount++;

    return {
      attempt_id: attemptId,
      question_id: answer.questionId,
      answer: JSON.stringify(normalizedStudentAnswer),
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
  correctAnswer?: number | boolean | string;
  userAnswer: string | number | boolean;
  isCorrect: boolean;
}

export interface QuizResultWithAnswers {
  attempt: QuizAttempt;
  answers: QuizResultAnswer[];
}

// Get attempt with answers and question details for showing results
export async function getQuizAttemptWithAnswers(
  attemptId: string,
  options?: { includeCorrectAnswers?: boolean }
): Promise<QuizResultWithAnswers | null> {
  const supabase = createClient();
  const includeCorrectAnswers = Boolean(options?.includeCorrectAnswers);

  const { data: attempt, error: attemptErr } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (attemptErr || !attempt) return null;

  const questionFields = includeCorrectAnswers
    ? "id, question, type, options, correct_answer"
    : "id, question, type, options";
  const { data: answersRows, error: answersErr } = await supabase
    .from("quiz_answers")
    .select(`id, attempt_id, question_id, answer, is_correct, questions(${questionFields})`)
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
        if (typeof p === "boolean" || typeof p === "number") return p;
        if (typeof p === "string") {
          const trimmed = p.trim();
          if (trimmed === "true") return true;
          if (trimmed === "false") return false;
          if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
          return trimmed;
        }
        return String(p);
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
      q.correct_answer == null
        ? undefined
        : typeof q.correct_answer === "string"
          ? JSON.parse(q.correct_answer || "null")
          : q.correct_answer;
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
      ...(includeCorrectAnswers ? { correctAnswer: correctRaw } : {}),
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

// Delete a quiz and its related data (answers, attempts, quiz_questions).
// This is designed for professor use in the quiz management UI.
export async function deleteQuiz(quizId: string): Promise<void> {
  const supabase = createClient();

  // Fetch all attempts for this quiz so we can delete their answers first.
  const { data: attempts, error: attemptsError } = await supabase
    .from("quiz_attempts")
    .select("id")
    .eq("quiz_id", quizId);

  if (attemptsError) {
    console.error("Error fetching quiz attempts before delete:", attemptsError);
    throw attemptsError;
  }

  const attemptIds = (attempts ?? []).map((a: any) => a.id);

  if (attemptIds.length > 0) {
    // Delete all answers tied to those attempts.
    const { error: answersError } = await supabase
      .from("quiz_answers")
      .delete()
      .in("attempt_id", attemptIds);

    if (answersError) {
      console.error("Error deleting quiz answers:", answersError);
      throw answersError;
    }

    // Delete the attempts themselves.
    const { error: attemptsDelError } = await supabase
      .from("quiz_attempts")
      .delete()
      .in("id", attemptIds);

    if (attemptsDelError) {
      console.error("Error deleting quiz attempts:", attemptsDelError);
      throw attemptsDelError;
    }
  }

  // Delete quiz_questions entries for this quiz.
  const { error: qqError } = await supabase
    .from("quiz_questions")
    .delete()
    .eq("quiz_id", quizId);

  if (qqError) {
    console.error("Error deleting quiz questions:", qqError);
    throw qqError;
  }

  // Finally, delete the quiz itself.
  const { error: quizError } = await supabase
    .from("quizzes")
    .delete()
    .eq("id", quizId);

  if (quizError) {
    console.error("Error deleting quiz:", quizError);
    throw quizError;
  }
}


