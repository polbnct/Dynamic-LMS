-- Question signature dedupe migration for existing databases.
-- Run this in Supabase SQL editor (safe to re-run).

BEGIN;

-- 1) Add signature column to existing questions table.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_signature TEXT;

-- 2) Enforce per-course/type dedupe when signature is present.
--    Dedupe is question-stem-only (ignores options/answers and type).
--    Drop legacy index shape if it exists, then recreate with new scope.
DROP INDEX IF EXISTS public.idx_questions_course_type_signature_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_course_type_signature_unique
  ON public.questions (course_id, question_signature)
  WHERE question_signature IS NOT NULL;

COMMIT;

-- Optional backfill note:
-- Existing rows can remain NULL in question_signature.
-- New/updated app writes now populate question_signature and dedupe via the index.
