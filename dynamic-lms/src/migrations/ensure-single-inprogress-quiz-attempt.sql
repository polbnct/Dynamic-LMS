-- Migration: Ensure only one in-progress quiz_attempt per student/quiz
-- Problem this fixes:
-- In React Strict Mode or with fast double-clicks, multiple
-- /api/quizzes/start-attempt requests can run in parallel before any
-- attempt row is visible to the others. Without a unique constraint,
-- this can create multiple in-progress rows for the same
-- (quiz_id, student_id), which then show up as "two attempts" for a
-- single actual take.

-- Step 1: Clean up existing duplicate in-progress attempts.
-- We keep the most recent attempt (highest id) and delete older
-- in-progress rows for the same quiz_id + student_id.
DELETE FROM public.quiz_attempts a
USING public.quiz_attempts b
WHERE a.id < b.id
  AND a.quiz_id = b.quiz_id
  AND a.student_id = b.student_id
  AND a.submitted_at IS NULL
  AND b.submitted_at IS NULL;

-- Step 2: Add a partial unique index to enforce at most ONE
-- in-progress attempt (submitted_at IS NULL) per quiz+student.
-- This works together with /api/quizzes/start-attempt, which:
-- - reuses any existing in-progress attempt
-- - and, on rare race conditions, catches unique violations and
--   re-fetches the single in-progress row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_unique_inprogress
ON public.quiz_attempts (quiz_id, student_id)
WHERE submitted_at IS NULL;

