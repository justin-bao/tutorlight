import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { apiUrl } from "@/lib/api";
import { useSession, signOut } from "@/lib/auth";
import { Sparkles, BookOpen, ArrowRight, Loader2, LogOut } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const EXAMPLES = [
  "How transformer models actually work",
  "The Krebs cycle, simply explained",
  "Intro to Japanese hiragana",
  "Why interest rates affect the economy",
  "The basics of color theory",
  "How CRISPR edits genes",
];

function Index() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  async function handleStart(e?: React.FormEvent) {
    e?.preventDefault();
    if (!topic.trim() || submitting) return;
    setError(null);

    if (!user) {
      // Stash topic and route to auth
      sessionStorage.setItem("pending_topic", topic.trim());
      navigate({ to: "/auth" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: insertErr } = await supabase
        .from("lessons")
        .insert({ user_id: user.id, topic: topic.trim(), status: "generating" })
        .select("id")
        .single();
      if (insertErr || !data) throw insertErr ?? new Error("Could not create lesson");
      // Kick off generation in background
      fetch(apiUrl("/api/generate-lesson"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ lessonId: data.id, topic: topic.trim() }),
      }).catch(() => {});
      navigate({ to: "/lesson/$lessonId", params: { lessonId: data.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="ambient-glow" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <span className="font-display text-xl tracking-tight">Tutorlight</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/lessons"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <BookOpen className="h-4 w-4" /> My lessons
              </Link>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-secondary px-4 py-1.5 text-sm transition hover:bg-secondary/70"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-3xl flex-col items-center justify-center px-6 pb-24 pt-8 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Live AI tutor · Dynamic whiteboard
        </div>

        <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-7xl">
          What do you want
          <br />
          <span className="italic text-primary">to learn today?</span>
        </h1>

        <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          Type any topic. A tutor will appear on stage and teach it to you live — building diagrams,
          equations, and notes on a whiteboard as they speak.
        </p>

        <form onSubmit={handleStart} className="mt-10 w-full max-w-2xl">
          <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-1.5 shadow-2xl shadow-black/40 backdrop-blur transition focus-within:border-primary/60 focus-within:shadow-primary/10">
            <input
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How black holes form"
              className="w-full bg-transparent px-4 py-4 text-lg outline-none placeholder:text-muted-foreground/60"
              disabled={submitting || loading}
            />
            <button
              type="submit"
              disabled={!topic.trim() || submitting || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {submitting ? "Preparing" : "Start lesson"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </form>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setTopic(ex)}
              className="rounded-full border border-border/60 bg-card/30 px-3.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-card/60 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
