-- ============================================
-- RECREATE ALL TABLES WITHOUT RLS
-- ============================================
-- This script drops all tables and recreates them without RLS enabled
-- WARNING: This will DELETE ALL DATA in your database!
-- Make sure you have backups if needed.
-- Run this in your Supabase SQL Editor
-- ============================================

-- Step 1: Drop all existing tables (in reverse dependency order)
DROP TABLE IF EXISTS public.quiz_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.quiz_questions CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.professors CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Step 2: Drop existing types (will be recreated)
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.content_category CASCADE;
DROP TYPE IF EXISTS public.question_type CASCADE;
DROP TYPE IF EXISTS public.source_origin CASCADE;

-- Step 3: Drop existing functions and triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================
-- CREATE CUSTOM TYPES (ENUMS)
-- ============================================

CREATE TYPE user_role AS ENUM ('professor', 'student');
CREATE TYPE content_category AS ENUM ('prelim', 'midterm', 'finals');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false', 'fill_blank');
CREATE TYPE source_origin AS ENUM ('lesson', 'pdf');

-- ============================================
-- CREATE TABLES
-- ============================================

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
  CONSTRAINT unique_professor_user UNIQUE(user_id)
);

-- 3. Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT UNIQUE NOT NULL,
  CONSTRAINT unique_student_user UNIQUE(user_id)
);

-- 4. Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  classroom_code TEXT UNIQUE NOT NULL,
  professor_id UUID REFERENCES public.professors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  pdf_file_path TEXT,
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
  options JSONB,
  correct_answer JSONB NOT NULL,
  source_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  source_type source_origin,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type question_type,
  time_limit INTEGER,
  due_date TIMESTAMPTZ,
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

-- ============================================
-- DISABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.professors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers DISABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE FUNCTION TO CREATE USER RECORD
-- ============================================

CREATE OR REPLACE FUNCTION public.create_user_record(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_role user_role
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (p_user_id, p_email, p_name, p_role)
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    role = COALESCE(EXCLUDED.role, users.role);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating user record: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_name TEXT;
  user_role_val user_role;
BEGIN
  -- Extract name and role from metadata with defaults
  user_name := COALESCE(new.raw_user_meta_data->>'name', 'User');
  
  -- Safely extract role, default to student if invalid
  BEGIN
    user_role_val := (new.raw_user_meta_data->>'role')::user_role;
  EXCEPTION
    WHEN OTHERS THEN
      user_role_val := 'student'::user_role;
  END;

  -- Insert directly (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.users (id, email, name, role)
  VALUES (new.id, COALESCE(new.email, ''), user_name, user_role_val)
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    role = COALESCE(EXCLUDED.role, users.role);
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but NEVER fail the auth signup - just return new
    -- This allows the user to be created in auth.users even if users table insert fails
    RAISE WARNING 'Error in handle_new_user trigger for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE TRIGGER
-- ============================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- VERIFICATION
-- ============================================
-- Check that RLS is disabled on all tables
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN 'ENABLED ❌' 
        ELSE 'DISABLED ✅' 
    END as "RLS Status"
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'users', 'professors', 'students', 'courses', 'enrollments',
        'lessons', 'assignments', 'assignment_submissions', 'questions',
        'quizzes', 'quiz_questions', 'quiz_attempts', 'quiz_answers'
    )
ORDER BY tablename;

-- All tables should show "DISABLED ✅"
-- If you see this, you're done! All tables are recreated without RLS.
