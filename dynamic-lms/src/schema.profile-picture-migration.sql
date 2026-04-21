-- Profile image migration for existing databases
-- Safe to run multiple times.

BEGIN;

ALTER TABLE public.professors
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

COMMIT;

-- Storage setup note:
-- Create a public bucket named "profile-images" in Supabase Storage.
