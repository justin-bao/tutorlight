
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS learned_concepts jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS lessons_user_completed_at_idx
  ON public.lessons (user_id, completed_at DESC);
