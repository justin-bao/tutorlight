
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lessons
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  topic TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'generating', -- generating | ready | failed
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons_all_own" ON public.lessons FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX lessons_user_created_idx ON public.lessons (user_id, created_at DESC);

-- Lesson sections
CREATE TABLE public.lesson_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  heading TEXT NOT NULL,
  script TEXT NOT NULL,
  estimated_duration_s INT NOT NULL DEFAULT 60,
  whiteboard JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lesson_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_sections_all_own" ON public.lesson_sections
  FOR ALL USING (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.user_id = auth.uid()));
CREATE INDEX lesson_sections_lesson_idx ON public.lesson_sections (lesson_id, order_index);

-- Lesson messages (Q&A)
CREATE TABLE public.lesson_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.lesson_sections(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  pinned_element_id TEXT,
  whiteboard_addendum JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lesson_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_messages_all_own" ON public.lesson_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.user_id = auth.uid()));
CREATE INDEX lesson_messages_lesson_idx ON public.lesson_messages (lesson_id, created_at);
