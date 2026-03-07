-- Migration: Add max_submissions column to assignments
-- Allows professors to limit how many times a student can submit an assignment

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS max_submissions INTEGER CHECK (max_submissions IS NULL OR max_submissions > 0);

COMMENT ON COLUMN public.assignments.max_submissions IS 'Maximum number of submissions allowed per student (NULL means unlimited)';

