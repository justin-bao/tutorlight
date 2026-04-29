import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Whiteboard } from "@/components/whiteboard/Whiteboard";
import { useSectionTimeline } from "@/components/whiteboard/useSectionTimeline";
import { TutorOrb } from "@/components/lesson/TutorOrb";
import { useTutorSpeech } from "@/components/lesson/useTutorSpeech";
import { summarize } from "@/components/whiteboard/WhiteboardElement";
import type { WhiteboardEvent } from "@/lib/whiteboard-types";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Send,
  Sparkles,
  X,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/lesson/$lessonId")({
  component: LessonView,
});

interface LessonRow {
  id: string;
  topic: string;
  title: string | null;
  summary: string | null;
  status: string;
  error: string | null;
}
interface SectionRow {
  id: string;
  order_index: number;
  heading: string;
  script: string;
  estimated_duration_s: number;
  whiteboard: WhiteboardEvent[];
  sources: { title: string; url: string }[];
}
interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  section_id: string | null;
  created_at: string;
}

function LessonView() {
  const { lessonId } = Route.useParams();
  const { user, loading: authLoading } = useSession();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [pollErr, setPollErr] = useState<string | null>(null);

  const tutor = useTutorSpeech();
  const activeSection = sections[activeIdx];
  const timeline = useSectionTimeline(activeSection?.id ?? null, false);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  // Initial load + poll while generating
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      const [{ data: l }, { data: s }, { data: m }] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
        supabase.from("lesson_sections").select("*").eq("lesson_id", lessonId).order("order_index"),
        supabase.from("lesson_messages").select("*").eq("lesson_id", lessonId).order("created_at"),
      ]);
      if (cancelled) return;
      if (l) setLesson(l as LessonRow);
      if (s) setSections(s as SectionRow[]);
      if (m) setMessages(m as MessageRow[]);
      if (l && (l as LessonRow).status === "failed") setPollErr((l as LessonRow).error ?? "Generation failed");
    }

    load();
    interval = setInterval(async () => {
      const { data } = await supabase.from("lessons").select("status").eq("id", lessonId).maybeSingle();
      if (data?.status === "ready" || data?.status === "failed") {
        await load();
        if (interval) clearInterval(interval);
      }
    }, 2000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [lessonId]);

  // When section changes, speak it
  useEffect(() => {
    if (!activeSection) return;
    tutor.stop();
    timeline.reset();
    timeline.play();
    tutor.speak(activeSection.script, () => {
      timeline.pause();
    });
    return () => tutor.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection?.id]);

  const pinnedEvent = useMemo(() => {
    if (!pinnedId || !activeSection) return null;
    return activeSection.whiteboard.find((e) => e.id === pinnedId) ?? null;
  }, [pinnedId, activeSection]);

  function togglePlay() {
    if (tutor.speaking) {
      tutor.pause();
      timeline.pause();
    } else {
      tutor.resume();
      timeline.play();
    }
  }

  function jumpTo(idx: number) {
    setActiveIdx(idx);
    setPinnedId(null);
  }

  async function askQuestion(e?: React.FormEvent) {
    e?.preventDefault();
    if (!question.trim() || asking || !activeSection) return;
    const q = question.trim();
    setAsking(true);
    setQuestion("");
    tutor.pause();
    timeline.pause();

    // Optimistic user message
    const tmpId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tmpId, role: "user", content: q, section_id: activeSection.id, created_at: new Date().toISOString() },
    ]);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? "";
      const resp = await fetch("/api/lesson-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lessonId,
          sectionId: activeSection.id,
          question: q,
          pinnedElement: pinnedEvent
            ? { id: pinnedEvent.id, type: pinnedEvent.type, summary: summarize(pinnedEvent) }
            : null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed");
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          section_id: activeSection.id,
          created_at: new Date().toISOString(),
        },
      ]);
      setPinnedId(null);
      tutor.speak(data.answer);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: err instanceof Error ? `Sorry — ${err.message}` : "Sorry, something went wrong.",
          section_id: activeSection?.id ?? null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  // ============== RENDER ==============
  if (lesson?.status === "failed") {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="ambient-glow" />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-3xl">Couldn't build this lesson</h1>
          <p className="mt-2 text-sm text-muted-foreground">{pollErr ?? lesson.error ?? "Try a different topic."}</p>
          <Link to="/" className="mt-6 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  if (!lesson || lesson.status === "generating" || sections.length === 0) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="ambient-glow" />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <h1 className="mt-5 font-display text-3xl tracking-tight">Building your lesson…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The tutor is preparing the whiteboard for <span className="italic">"{lesson?.topic}"</span>.
          </p>
        </div>
      </div>
    );
  }

  const sectionMessages = messages.filter((m) => m.section_id === activeSection?.id);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="ambient-glow opacity-60" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-border/50 px-5 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Lesson</div>
            <h1 className="truncate font-display text-lg leading-tight md:text-xl">{lesson.title ?? lesson.topic}</h1>
          </div>
        </div>
        <Link to="/lessons" className="rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary/70 hover:text-foreground">
          My lessons
        </Link>
      </header>

      {/* Main */}
      <div className="relative z-10 flex flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:px-6 md:py-5">
        {/* Whiteboard (centerpiece) */}
        <div className="relative flex-1 min-h-[440px] md:min-h-0">
          <Whiteboard
            events={activeSection?.whiteboard ?? []}
            elapsed={timeline.elapsed}
            pinnedId={pinnedId}
            onPin={setPinnedId}
            sectionHeading={activeSection?.heading ?? ""}
          />
        </div>

        {/* Right column */}
        <aside className="flex w-full shrink-0 flex-col gap-4 md:w-[320px]">
          {/* Outline */}
          <div className="rounded-2xl border border-border/60 bg-card/50 p-3 backdrop-blur">
            <div className="mb-2 px-2 text-xs uppercase tracking-widest text-muted-foreground">Outline</div>
            <ol className="flex flex-col gap-0.5">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => jumpTo(i)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                      i === activeIdx
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${
                        i === activeIdx ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">{s.heading}</span>
                    {i === activeIdx && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary" />}
                  </button>
                </li>
              ))}
            </ol>
            {activeSection?.sources && activeSection.sources.length > 0 && (
              <div className="mt-3 border-t border-border/50 pt-3">
                <div className="mb-1.5 px-2 text-xs uppercase tracking-widest text-muted-foreground">Sources</div>
                <ul className="flex flex-col gap-0.5">
                  {activeSection.sources.map((src) => (
                    <li key={src.url}>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Tutor stage */}
          <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur">
            <TutorOrb speaking={tutor.speaking} thinking={asking} amplitude={tutor.amplitude} />
            <button
              onClick={togglePlay}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground transition hover:brightness-105"
            >
              {tutor.speaking ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {tutor.speaking ? "Pause" : "Resume"}
            </button>
          </div>

          {/* Q&A */}
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/60 bg-card/50 p-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Ask the tutor</div>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-1 pb-2 text-sm">
              {sectionMessages.length === 0 && (
                <p className="text-xs italic text-muted-foreground">
                  Click anything on the whiteboard to ask about it, or type a question below.
                </p>
              )}
              {sectionMessages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl px-3 py-2 ${
                    m.role === "user"
                      ? "ml-4 bg-primary/15 text-foreground"
                      : "mr-4 bg-secondary text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>

            {pinnedEvent && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5 text-xs">
                <span className="truncate">
                  About: <span className="italic">{summarize(pinnedEvent)}</span>
                </span>
                <button onClick={() => setPinnedId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <form onSubmit={askQuestion} className="flex items-end gap-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    askQuestion();
                  }
                }}
                placeholder="Ask a question…"
                rows={1}
                className="min-h-[40px] w-full resize-none rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none transition focus:border-primary/60"
                disabled={asking}
              />
              <button
                type="submit"
                disabled={!question.trim() || asking}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-105 disabled:opacity-40"
              >
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
