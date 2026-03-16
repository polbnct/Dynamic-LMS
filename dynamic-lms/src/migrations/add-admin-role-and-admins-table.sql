-- Add admin role + admins table (manual admin provisioning only)
--
-- Notes:
-- - Admin users are created manually in Supabase Auth.
-- - After the auth user exists, set `public.users.role = 'admin'` for that user.
-- - Optionally also insert the user's id into `public.admins`.
--
-- Example:
--   UPDATE public.users SET role = 'admin' WHERE email = 'admin@example.com';
--   INSERT INTO public.admins (user_id)
--   SELECT id FROM public.users WHERE email = 'admin@example.com'
--   ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  -- Extend enum to include 'admin'
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'admin';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_admin_user UNIQUE(user_id)
);

