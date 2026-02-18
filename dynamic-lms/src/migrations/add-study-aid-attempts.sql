-- Study aid attempts: store score each time a student completes multiple choice or fill-in-the-blank
CREATE TABLE IF NOT EXISTS public.study_aid_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'fill_blank')),
  score INTEGER NOT NULL CHECK (score >= 0),
  max_score INTEGER NOT NULL CHECK (max_score > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_aid_attempts_lesson ON public.study_aid_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_study_aid_attempts_student ON public.study_aid_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_study_aid_attempts_created ON public.study_aid_attempts(created_at DESC);

COMMENT ON TABLE public.study_aid_attempts IS 'Scores for study aid practice (multiple choice and fill in the blank) per attempt';
