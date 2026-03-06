-- Migration: Add quiz attempt limits and professor-granted retakes

-- 1) Add max_attempts to quizzes
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1;

-- Ensure sane values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quizzes_max_attempts_check'
  ) THEN
    ALTER TABLE public.quizzes
    ADD CONSTRAINT quizzes_max_attempts_check CHECK (max_attempts IS NULL OR max_attempts >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.quizzes.max_attempts IS 'Maximum number of submitted attempts allowed per student. NULL means unlimited.';

-- 2) Retake allowances (extra attempts per student)
CREATE TABLE IF NOT EXISTS public.quiz_retakes (
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  extra_attempts INTEGER NOT NULL DEFAULT 0 CHECK (extra_attempts >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quiz_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_retakes_quiz_id
ON public.quiz_retakes(quiz_id);

COMMENT ON TABLE public.quiz_retakes IS 'Professor-granted extra attempts per student per quiz';

