-- Migration: ensure only one in-progress quiz attempt per student per quiz
-- Prevents duplicate "online" attempts caused by concurrent start-attempt calls

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_unique_inprogress
ON public.quiz_attempts(quiz_id, student_id)
WHERE submitted_at IS NULL;

