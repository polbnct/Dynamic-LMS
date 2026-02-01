-- ============================================
-- DISABLE THE TRIGGER THAT'S BLOCKING SIGNUP
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop the trigger completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Verify it's gone
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Should return no rows if trigger is disabled
