import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

interface Suggestion {
  title: string;
  reason: string;
}

interface Props {
  lessonId: string;
  userId: string | undefined;
}

export function SuggestedTopics({ lessonId, userId }: Props) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token ?? "";
        const r = await fetch(apiUrl("/api/lesson-suggestions"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lessonId }),
        });
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(data.error ?? "Failed");
        setTopics(data.topics ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Couldn't load suggestions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function startLesson(topic: string) {
    if (!userId || starting) return;
    setStarting(topic);
    try {
      const { data, error } = await supabase
        .from("lessons")
        .insert({ user_id: userId, topic, status: "generating" })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Could not create lesson");
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? "";
      fetch(apiUrl("/api/generate-lesson"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lessonId: data.id, topic }),
      }).catch(() => {});
      navigate({ to: "/lesson/$lessonId", params: { lessonId: data.id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start lesson");
      setStarting(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg tracking-tight">What's next?</h2>
        <span className="text-xs text-muted-foreground">Pick a follow-up to keep going.</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Generating ideas…
        </div>
      )}

      {err && !loading && <p className="px-1 text-sm text-destructive">{err}</p>}

      {!loading && topics && topics.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {topics.map((t) => {
            const isStarting = starting === t.title;
            return (
              <button
                key={t.title}
                onClick={() => startLesson(t.title)}
                disabled={!!starting}
                className="group flex flex-col gap-1 rounded-xl border border-border/60 bg-background/40 p-3 text-left transition hover:border-primary/50 hover:bg-background/70 disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-snug">{t.title}</span>
                  {isStarting ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  )}
                </div>
                {t.reason && (
                  <span className="text-xs text-muted-foreground">{t.reason}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!loading && topics && topics.length === 0 && !err && (
        <p className="px-1 text-sm text-muted-foreground">No suggestions available.</p>
      )}
    </div>
  );
}
