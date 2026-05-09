import { useEffect, useMemo, useRef } from "react";

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

interface TranscriptProps {
  words: TranscriptWord[] | null;
  fallbackText: string;
  elapsed: number;
  onSeek?: (timeSeconds: number) => void;
}

/**
 * Renders the lesson section script with the active word highlighted in
 * sync with audio playback. Falls back to plain text when alignment is not
 * yet available (e.g. browser-TTS fallback or while audio is synthesizing).
 */
export function Transcript({ words, fallbackText, elapsed, onSeek }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);

  const activeIndex = useMemo(() => {
    if (!words || words.length === 0) return -1;
    // Find the last word whose start <= elapsed.
    let lo = 0;
    let hi = words.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid].start <= elapsed) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return idx;
  }, [words, elapsed]);

  // Auto-scroll the active word into view.
  useEffect(() => {
    const el = activeRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    if (elRect.top < cRect.top + 24 || elRect.bottom > cRect.bottom - 24) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  if (!words || words.length === 0) {
    return (
      <div
        ref={containerRef}
        className="max-h-48 overflow-y-auto rounded-2xl border border-border/60 bg-card/50 p-3 text-sm leading-relaxed text-muted-foreground backdrop-blur"
      >
        {fallbackText || <span className="italic">Transcript will appear here…</span>}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="max-h-48 overflow-y-auto rounded-2xl border border-border/60 bg-card/50 p-3 text-sm leading-relaxed backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Transcript</span>
      </div>
      <p className="text-foreground/80">
        {words.map((w, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <span key={i}>
              <span
                ref={isActive ? activeRef : undefined}
                onClick={() => onSeek?.(w.start)}
                className={
                  "cursor-pointer rounded px-0.5 transition-colors " +
                  (isActive
                    ? "bg-primary/30 text-foreground"
                    : isPast
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                }
              >
                {w.text}
              </span>{" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}
