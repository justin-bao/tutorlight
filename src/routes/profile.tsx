import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, signOut } from "@/lib/auth";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CalendarDays,
  Clock,
  Loader2,
  LogOut,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

interface LessonRow {
  id: string;
  topic: string;
  title: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  learned_concepts: string[] | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  created_at: string;
}

function ProfilePage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile((data as ProfileRow) ?? null));
    supabase
      .from("lessons")
      .select("id,topic,title,status,created_at,completed_at,learned_concepts")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setLessons(((data ?? []) as unknown) as LessonRow[]));
  }, [user]);

  const stats = useMemo(() => {
    const list = lessons ?? [];
    const completed = list.filter((l) => l.completed_at || (l.learned_concepts?.length ?? 0) > 0);
    const concepts = list.flatMap((l) => l.learned_concepts ?? []);
    const days = new Set(
      list.map((l) => new Date(l.completed_at ?? l.created_at).toDateString()),
    );
    return {
      total: list.length,
      completed: completed.length,
      concepts: concepts.length,
      activeDays: days.size,
    };
  }, [lessons]);

  const recentConcepts = useMemo(() => {
    const seen = new Set<string>();
    const out: { concept: string; lessonId: string; lessonTitle: string }[] = [];
    for (const l of lessons ?? []) {
      for (const c of l.learned_concepts ?? []) {
        const key = c.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ concept: c, lessonId: l.id, lessonTitle: l.title ?? l.topic });
        if (out.length >= 30) break;
      }
      if (out.length >= 30) break;
    }
    return out;
  }, [lessons]);

  const displayName = profile?.display_name ?? user?.email?.split("@")[0] ?? "Learner";
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="ambient-glow opacity-60" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <Link
          to="/lessons"
          className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> My lessons
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground transition hover:brightness-105"
          >
            <Sparkles className="h-3.5 w-3.5" /> New lesson
          </Link>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-6">
        <section className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-semibold uppercase text-primary">
            {displayName.slice(0, 1)}
          </div>
          <div>
            <h1 className="font-display text-4xl tracking-tight md:text-5xl">{displayName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Learning since {memberSince}</p>
          </div>
        </section>

        {lessons === null ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<BookOpen className="h-4 w-4" />} label="Lessons" value={stats.total} />
              <StatCard icon={<Sparkles className="h-4 w-4" />} label="Completed" value={stats.completed} />
              <StatCard icon={<Brain className="h-4 w-4" />} label="Concepts" value={stats.concepts} />
              <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Active days" value={stats.activeDays} />
            </section>

            <section className="mt-10">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <h2 className="font-display text-xl tracking-tight">What you've learned</h2>
              </div>
              {recentConcepts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-6 text-sm text-muted-foreground">
                  Finish a lesson and the tutor will remember the key ideas here.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recentConcepts.map((c) => (
                    <Link
                      key={c.lessonId + c.concept}
                      to="/lesson/$lessonId"
                      params={{ lessonId: c.lessonId }}
                      title={`From: ${c.lessonTitle}`}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-foreground/90 transition hover:border-primary/40 hover:bg-card/80"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/70 transition group-hover:bg-primary" />
                      {c.concept}
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="font-display text-xl tracking-tight">Recent activity</h2>
              </div>
              {lessons.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-6 text-sm text-muted-foreground">
                  No lessons yet.{" "}
                  <Link to="/" className="text-primary hover:underline">
                    Start your first one
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-2">
                  {lessons.slice(0, 8).map((l) => (
                    <li key={l.id}>
                      <Link
                        to="/lesson/$lessonId"
                        params={{ lessonId: l.id }}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 transition hover:border-primary/40 hover:bg-card/80"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{l.title ?? l.topic}</div>
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                            {new Date(l.completed_at ?? l.created_at).toLocaleDateString()}
                            {(l.learned_concepts?.length ?? 0) > 0 && (
                              <span className="ml-2 text-primary/80">
                                · {l.learned_concepts!.length} concepts
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                            l.status === "ready"
                              ? "bg-primary/20 text-primary"
                              : l.status === "failed"
                                ? "bg-destructive/20 text-destructive"
                                : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {l.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-3xl tracking-tight">{value}</div>
    </div>
  );
}
