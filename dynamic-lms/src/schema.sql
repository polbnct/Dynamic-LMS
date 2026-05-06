-- Create custom types (Enums)
CREATE TYPE user_role AS ENUM ('professor', 'student');
CREATE TYPE content_category AS ENUM ('prelim', 'midterm', 'finals');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false', 'fill_blank', 'summary');
CREATE TYPE source_origin AS ENUM ('lesson', 'pdf');

-- 1. Users table (Extends Supabase Auth)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Professors table
CREATE TABLE public.professors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  department TEXT,
  profile_image_url TEXT,
  -- Add additional profile fields here
  CONSTRAINT unique_professor_user UNIQUE(user_id)
);

-- 3. Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT UNIQUE NOT NULL,
  profile_image_url TEXT,
  -- Add additional profile fields here
  CONSTRAINT unique_student_user UNIQUE(user_id)
);

-- 4. Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  -- Invite codes removed (no classroom_code).
  professor_id UUID REFERENCES public.professors(id) ON DELETE SET NULL,
  unlock_threshold_percent INTEGER NOT NULL DEFAULT 70 CHECK (unlock_threshold_percent >= 1 AND unlock_threshold_percent <= 100),
  shuffle_study_aid_questions BOOLEAN NOT NULL DEFAULT TRUE,
  require_both_for_unlock BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Existing DB upgrade (safe to run in Supabase SQL editor):
-- ALTER TABLE public.courses
--   ADD COLUMN IF NOT EXISTS unlock_threshold_percent INTEGER NOT NULL DEFAULT 70;
-- ALTER TABLE public.courses
--   ADD COLUMN IF NOT EXISTS shuffle_study_aid_questions BOOLEAN NOT NULL DEFAULT TRUE;
-- ALTER TABLE public.courses
--   ADD COLUMN IF NOT EXISTS require_both_for_unlock BOOLEAN NOT NULL DEFAULT TRUE;
-- ALTER TABLE public.courses
--   ADD CONSTRAINT courses_unlock_threshold_percent_check
--   CHECK (unlock_threshold_percent >= 1 AND unlock_threshold_percent <= 100);

-- 5. Enrollments (Junction Table)
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, student_id)
);

-- 6. Lessons table
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category content_category NOT NULL,
  "order" INTEGER DEFAULT 0,
  pdf_file_path TEXT, -- Storage path
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category content_category NOT NULL,
  pdf_file_path TEXT,
  due_date TIMESTAMPTZ,
  max_submissions INTEGER CHECK (max_submissions IS NULL OR max_submissions > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Assignment Submissions
CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  score INTEGER,
  max_score INTEGER NOT NULL,
  graded_at TIMESTAMPTZ,
  feedback TEXT
);

-- 9. Questions (The Bank)
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  professor_id UUID REFERENCES public.professors(id) ON DELETE CASCADE,
  type question_type NOT NULL,
  question TEXT NOT NULL,
  question_signature TEXT,
  options JSONB, -- For multiple choice: ["A", "B", "C"]
  correct_answer JSONB NOT NULL,
  fill_blank_answer_mode TEXT CHECK (fill_blank_answer_mode IN ('symbol_only', 'term_only')),
  source_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  source_type source_origin,
  is_study_aid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_course_type_signature_unique
  ON public.questions (course_id, question_signature)
  WHERE question_signature IS NOT NULL;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS fill_blank_answer_mode TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_fill_blank_answer_mode_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_fill_blank_answer_mode_check
      CHECK (fill_blank_answer_mode IN ('symbol_only', 'term_only'));
  END IF;
END $$;

UPDATE public.questions
SET fill_blank_answer_mode = 'term_only'
WHERE type = 'fill_blank' AND (fill_blank_answer_mode IS NULL OR fill_blank_answer_mode = '');

-- Denormalized flag so the question-bank fetch can filter directly in SQL
-- instead of pre-loading the full lesson_study_questions table.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS is_study_aid BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing rows linked as lesson study aids.
UPDATE public.questions
SET is_study_aid = TRUE
WHERE id IN (SELECT question_id FROM public.lesson_study_questions);

-- Hot path: course-scoped bank fetch excludes study-aid rows.
CREATE INDEX IF NOT EXISTS idx_questions_course_bank
  ON public.questions (course_id)
  WHERE is_study_aid = FALSE;

-- 10. Quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category content_category NOT NULL DEFAULT 'prelim',
  type question_type, -- or 'mixed' if you add that to the enum
  time_limit INTEGER, -- in minutes
  due_date TIMESTAMPTZ,
  max_attempts INTEGER,
  points_per_question INTEGER NOT NULL DEFAULT 10,
  reveal_correct_answers BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Quiz Questions (Junction)
CREATE TABLE public.quiz_questions (
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  "order" INTEGER,
  PRIMARY KEY (quiz_id, question_id)
);

-- 12. Quiz Attempts
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score INTEGER,
  max_score INTEGER NOT NULL
);

-- 13. Quiz Answers (Per Attempt)
CREATE TABLE public.quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  answer JSONB,
  is_correct BOOLEAN
);

-- 14. Study Aid Attempts (scores for multiple choice / fill-in-the-blank practice per attempt)
CREATE TABLE IF NOT EXISTS public.study_aid_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'fill_blank')),
  score INTEGER NOT NULL CHECK (score >= 0),
  max_score INTEGER NOT NULL CHECK (max_score > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14b. Student private lesson flashcards
CREATE TABLE IF NOT EXISTS public.student_lesson_flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  question_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_lesson_flashcards_unique_signature
  ON public.student_lesson_flashcards (lesson_id, student_id, question_signature)
  WHERE question_signature IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_lesson_flashcards_lesson_student_created
  ON public.student_lesson_flashcards (lesson_id, student_id, created_at DESC);

ALTER TABLE public.student_lesson_flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_lesson_flashcards_select_own ON public.student_lesson_flashcards;
CREATE POLICY student_lesson_flashcards_select_own
  ON public.student_lesson_flashcards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_lesson_flashcards.student_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS student_lesson_flashcards_insert_own ON public.student_lesson_flashcards;
CREATE POLICY student_lesson_flashcards_insert_own
  ON public.student_lesson_flashcards
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_lesson_flashcards.student_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS student_lesson_flashcards_update_own ON public.student_lesson_flashcards;
CREATE POLICY student_lesson_flashcards_update_own
  ON public.student_lesson_flashcards
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_lesson_flashcards.student_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_lesson_flashcards.student_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS student_lesson_flashcards_delete_own ON public.student_lesson_flashcards;
CREATE POLICY student_lesson_flashcards_delete_own
  ON public.student_lesson_flashcards
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_lesson_flashcards.student_id
        AND s.user_id = auth.uid()
    )
  );

-- 15. Course announcements (professor-authored posts per course)
CREATE TABLE IF NOT EXISTS public.course_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES public.professors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_course_announcements_course_created
  ON public.course_announcements (course_id, created_at DESC);

-- 16. Announcement comments (enrolled students only)
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.course_announcements(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement_created
  ON public.announcement_comments (announcement_id, created_at);

-- 17. Announcement file attachments (Supabase Storage paths; bucket: announcement-files)
CREATE TABLE IF NOT EXISTS public.announcement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.course_announcements(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcement_attachments_announcement
  ON public.announcement_attachments (announcement_id);

-- Existing DB upgrade (run in Supabase SQL editor if tables were created without IF NOT EXISTS):
-- CREATE TABLE public.course_announcements (...);
-- CREATE TABLE public.announcement_comments (...);

-- RLS temporarily disabled for announcement feature tables.
-- (Run these in Supabase SQL editor for existing databases.)
ALTER TABLE public.course_announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_attachments DISABLE ROW LEVEL SECURITY;

-- Storage: create bucket "announcement-files" (public read), same pattern as assignment-pdfs.
-- If StorageApiError still appears, add permissive storage policies for this bucket
-- (or temporarily disable RLS on storage.objects if acceptable for your environment).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', (new.raw_user_meta_data->>'role')::user_role);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();