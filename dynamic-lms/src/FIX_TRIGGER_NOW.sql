-- ============================================
-- FIX THE TRIGGER THAT'S BLOCKING SIGNUP
-- ============================================
-- Run this in Supabase SQL Editor to fix the trigger
-- ============================================

-- Drop and recreate the trigger function to handle errors properly
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

-- Verify the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
