-- Migration: Add points_per_question to quizzes
-- Allows configuring how many points each quiz item is worth.

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS points_per_question INTEGER NOT NULL DEFAULT 10;

