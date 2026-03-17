-- Add persisted profile fields for students (used by student profile page).
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS graduation_year TEXT;

