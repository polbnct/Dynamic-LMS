-- Study aid questions per lesson (professor chooses questions; students see them in Study Aid)
-- Run this in Supabase Dashboard → SQL Editor if the table doesn't exist yet.
CREATE TABLE IF NOT EXISTS public.lesson_study_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 0,
  UNIQUE(lesson_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_study_questions_lesson ON public.lesson_study_questions(lesson_id);

COMMENT ON TABLE public.lesson_study_questions IS 'Links questions to lessons for the Study Aid feature (professor-selected)';
