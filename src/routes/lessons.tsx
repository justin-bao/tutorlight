import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { ArrowLeft, BookOpen, Loader2, Sparkles, User } from "lucide-react";

export const Route = createFileRoute("/lessons")({
  component: LessonsList,
});

interface LessonRow {
  id: string;
  topic: string;
  title: string | null;
  summary: string | null;
  status: string;
  created_at: string;
}

function LessonsList() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("lessons")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setLessons((data ?? []) as LessonRow[]));
  }, [user]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="ambient-glow opacity-60" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <User className="h-3.5 w-3.5" /> Profile
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground transition hover:brightness-105">
            <Sparkles className="h-3.5 w-3.5" /> New lesson
          </Link>
        </div>

      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-6">
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">My lessons</h1>
        <p className="mt-2 text-sm text-muted-foreground">Everything the tutor has taught you.</p>

        <div className="mt-8 space-y-3">
          {lessons === null ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : lessons.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-16 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No lessons yet. Start your first one.</p>
              <Link to="/" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
                Pick a topic
              </Link>
            </div>
          ) : (
            lessons.map((l) => (
              <Link
                key={l.id}
                to="/lesson/$lessonId"
                params={{ lessonId: l.id }}
                className="block rounded-2xl border border-border/60 bg-card/50 p-5 transition hover:border-primary/40 hover:bg-card/80"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</div>
                    <div className="mt-1 font-display text-xl tracking-tight">{l.title ?? l.topic}</div>
                    {l.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{l.summary}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-widest ${
                      l.status === "ready"
                        ? "bg-primary/20 text-primary"
                        : l.status === "failed"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {l.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
