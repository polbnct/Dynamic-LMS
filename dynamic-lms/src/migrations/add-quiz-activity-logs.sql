-- Migration: Store activity logs per quiz attempt (tab switch, focus, etc.)
-- Lets professors see a history of events for each attempt

CREATE TABLE IF NOT EXISTS public.quiz_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  tab_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_activity_logs_attempt_id
ON public.quiz_activity_logs(attempt_id, created_at DESC);

COMMENT ON TABLE public.quiz_activity_logs IS 'Log of focus/tab/activity events during a quiz attempt for professor review';
