-- Add audio columns
ALTER TABLE public.lesson_sections
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer,
  ADD COLUMN IF NOT EXISTS audio_voice_id text;

-- Create private bucket for lesson audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-audio', 'lesson-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: does the current user own this lesson?
CREATE OR REPLACE FUNCTION public.has_lesson_access(_lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = _lesson_id AND l.user_id = auth.uid()
  );
$$;

-- Storage RLS: users can read/write objects in lesson-audio for lessons they own.
-- Path convention: {lessonId}/{sectionId}.mp3
CREATE POLICY "lesson_audio_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lesson-audio'
  AND public.has_lesson_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "lesson_audio_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-audio'
  AND public.has_lesson_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "lesson_audio_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lesson-audio'
  AND public.has_lesson_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "lesson_audio_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lesson-audio'
  AND public.has_lesson_access(((storage.foldername(name))[1])::uuid)
);
