DO $$
BEGIN
  -- Extend enum to include 'summary' for Study Aid summaries.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'question_type' AND e.enumlabel = 'summary'
  ) THEN
    ALTER TYPE public.question_type ADD VALUE 'summary';
  END IF;
END $$;

