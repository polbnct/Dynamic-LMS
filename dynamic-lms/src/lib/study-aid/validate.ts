import type { FillBlankAnswerMode } from "@/lib/supabase/queries/study-aid";

export type StudyAidQuestionType =
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "summary";

export type StudyAidCorrectAnswer =
  | number
  | boolean
  | string
  | {
      answer: number | boolean | string;
      correct_explanation?: string;
      incorrect_explanation?: string;
    };

export interface StudyAidQuestionInput {
  type: StudyAidQuestionType;
  question: string;
  options?: string[];
  fill_blank_answer_mode?: FillBlankAnswerMode | null;
  correct_answer?: StudyAidCorrectAnswer | null;
}

export interface NormalizedStudyAidQuestion {
  type: StudyAidQuestionType;
  question: string;
  options?: string[];
  fill_blank_answer_mode?: FillBlankAnswerMode | null;
  correct_answer: StudyAidCorrectAnswer;
}

const BLANK_MARKER = /_{3,}/;

export function unwrapStudyAidAnswer(
  correctAnswer: StudyAidCorrectAnswer | null | undefined
): {
  value: number | boolean | string | null;
  correct_explanation?: string;
  incorrect_explanation?: string;
} {
  if (correctAnswer === null || correctAnswer === undefined) {
    return { value: null };
  }
  if (
    typeof correctAnswer === "object" &&
    correctAnswer !== null &&
    "answer" in correctAnswer
  ) {
    return {
      value: correctAnswer.answer,
      correct_explanation: correctAnswer.correct_explanation,
      incorrect_explanation: correctAnswer.incorrect_explanation,
    };
  }
  return { value: correctAnswer };
}

function buildAnswerPayload(
  answer: number | string,
  meta?: { correct_explanation?: string; incorrect_explanation?: string }
): StudyAidCorrectAnswer {
  const explanation = meta?.correct_explanation?.trim();
  const incorrect = meta?.incorrect_explanation?.trim();
  if (explanation || incorrect) {
    return {
      answer,
      ...(explanation ? { correct_explanation: explanation } : {}),
      ...(incorrect ? { incorrect_explanation: incorrect } : {}),
    };
  }
  return answer;
}

export function hasFillBlankMarker(question: string): boolean {
  return BLANK_MARKER.test(question);
}

export function validateStudyAidQuestionInput(
  q: StudyAidQuestionInput,
  options?: { isStudyAid?: boolean }
): { ok: true; normalized: NormalizedStudyAidQuestion } | { ok: false; error: string } {
  const isStudyAid = options?.isStudyAid ?? true;
  const type = q.type;
  const questionText = String(q.question ?? "").trim();
  const { value: rawAnswer, correct_explanation, incorrect_explanation } =
    unwrapStudyAidAnswer(q.correct_answer ?? null);
  const meta = { correct_explanation, incorrect_explanation };

  if (!type || !["multiple_choice", "true_false", "fill_blank", "summary"].includes(type)) {
    return { ok: false, error: "Invalid question type." };
  }

  if (!questionText) {
    return { ok: false, error: "Question text is required." };
  }

  if (type === "summary") {
    return {
      ok: true,
      normalized: {
        type: "summary",
        question: questionText,
        fill_blank_answer_mode: null,
        correct_answer: " ",
      },
    };
  }

  if (type === "multiple_choice") {
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const trimmedOptions = rawOptions.map((o) => String(o ?? "").trim());
    const nonEmptyOptions = trimmedOptions.filter((o) => o.length > 0);

    if (nonEmptyOptions.length < 2) {
      return {
        ok: false,
        error: "Multiple choice questions need at least two non-empty options.",
      };
    }

    const options = trimmedOptions.map((o, i) => o || `Option ${String.fromCharCode(65 + i)}`);
    const answerIndex =
      typeof rawAnswer === "number"
        ? rawAnswer
        : typeof rawAnswer === "string" && /^\d+$/.test(rawAnswer.trim())
          ? parseInt(rawAnswer.trim(), 10)
          : NaN;

    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      return {
        ok: false,
        error: "Select a valid correct answer within the option list.",
      };
    }

    return {
      ok: true,
      normalized: {
        type: "multiple_choice",
        question: questionText,
        options,
        fill_blank_answer_mode: null,
        correct_answer: buildAnswerPayload(answerIndex, meta),
      },
    };
  }

  if (type === "true_false") {
    if (isStudyAid && typeof rawAnswer === "boolean") {
      return {
        ok: false,
        error: "Flashcard study aids require a text back-side answer, not true/false.",
      };
    }

    const backText =
      typeof rawAnswer === "string"
        ? rawAnswer.trim()
        : rawAnswer === null || rawAnswer === undefined
          ? ""
          : String(rawAnswer).trim();

    if (!backText) {
      return {
        ok: false,
        error: "Flashcard back-side explanation is required.",
      };
    }

    return {
      ok: true,
      normalized: {
        type: "true_false",
        question: questionText,
        fill_blank_answer_mode: null,
        correct_answer: buildAnswerPayload(backText, meta),
      },
    };
  }

  if (type === "fill_blank") {
    if (!hasFillBlankMarker(questionText)) {
      return {
        ok: false,
        error: "Fill-in-the-blank questions must include a blank marker (___ or ______) in the question text.",
      };
    }

    const answerText =
      typeof rawAnswer === "string"
        ? rawAnswer.trim()
        : rawAnswer === null || rawAnswer === undefined
          ? ""
          : String(rawAnswer).trim();

    if (!answerText) {
      return { ok: false, error: "Fill-in-the-blank correct answer is required." };
    }

    const mode = q.fill_blank_answer_mode ?? "term_only";
    if (mode !== "symbol_only" && mode !== "term_only") {
      return {
        ok: false,
        error: "Fill-in-the-blank answer mode must be symbol_only or term_only.",
      };
    }

    return {
      ok: true,
      normalized: {
        type: "fill_blank",
        question: questionText,
        fill_blank_answer_mode: mode,
        correct_answer: buildAnswerPayload(answerText, meta),
      },
    };
  }

  return { ok: false, error: "Unsupported question type." };
}

export function validateStudyAidQuestionPatch(
  existing: StudyAidQuestionInput,
  patch: Partial<StudyAidQuestionInput>,
  options?: { isStudyAid?: boolean }
): { ok: true; normalized: NormalizedStudyAidQuestion } | { ok: false; error: string } {
  const merged: StudyAidQuestionInput = {
    type: patch.type ?? existing.type,
    question: patch.question !== undefined ? patch.question : existing.question,
    options: patch.options !== undefined ? patch.options : existing.options,
    fill_blank_answer_mode:
      patch.fill_blank_answer_mode !== undefined
        ? patch.fill_blank_answer_mode
        : existing.fill_blank_answer_mode,
    correct_answer:
      patch.correct_answer !== undefined ? patch.correct_answer : existing.correct_answer,
  };
  return validateStudyAidQuestionInput(merged, options);
}
