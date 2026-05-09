REVOKE ALL ON FUNCTION public.has_lesson_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_lesson_access(uuid) TO authenticated, service_role;
