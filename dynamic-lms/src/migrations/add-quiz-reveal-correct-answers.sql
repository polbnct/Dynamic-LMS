-- Allow professors to control whether students can see correct answers in quiz results.
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS reveal_correct_answers BOOLEAN NOT NULL DEFAULT FALSE;

