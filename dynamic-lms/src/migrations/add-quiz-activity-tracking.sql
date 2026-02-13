-- Migration: Add activity tracking columns to quiz_attempts table
-- This enables real-time monitoring of student quiz activity

-- Add columns for tracking student activity
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_focused BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS tab_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries on active attempts
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_activity 
ON public.quiz_attempts(quiz_id, submitted_at, last_activity_at)
WHERE submitted_at IS NULL;

-- Add comment to columns
COMMENT ON COLUMN public.quiz_attempts.is_online IS 'Whether the student is currently online/connected';
COMMENT ON COLUMN public.quiz_attempts.is_focused IS 'Whether the quiz tab is currently focused';
COMMENT ON COLUMN public.quiz_attempts.tab_count IS 'Number of tabs/windows with the quiz open';
COMMENT ON COLUMN public.quiz_attempts.last_activity_at IS 'Last time activity was recorded (heartbeat)';
