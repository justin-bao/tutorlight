import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, BookmarkIcon, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptSource {
  title: string;
  url: string;
}

interface TranscriptProps {
  words: TranscriptWord[] | null;
  fallbackText: string;
  elapsed: number;
  sources?: TranscriptSource[];
  onSeek?: (timeSeconds: number) => void;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "from", "by", "at", "as", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "into", "about", "your", "you",
  "how", "what", "why", "when", "which", "who", "whom", "whose", "guide",
  "introduction", "intro", "overview", "tutorial", "docs", "documentation",
  "wiki", "wikipedia", "article", "blog", "post", "page", "site", "official",
]);

function normalizeWord(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

/**
 * Pick the best transcript word index to attach each source citation to,
 * by matching meaningful tokens of the source title against the transcript.
 * Falls back to evenly-distributed positions when no match is found.
 */
function buildCitationMap(
  words: TranscriptWord[],
  sources: TranscriptSource[],
): Map<number, number[]> {
  const map = new Map<number, number[]>();
  const used = new Set<number>();

  sources.forEach((src, sIdx) => {
    const tokens = (src.title || src.url)
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t));

    let best = -1;
    if (tokens.length > 0) {
      for (let i = 0; i < words.length; i++) {
        if (used.has(i)) continue;
        const w = normalizeWord(words[i].text);
        if (!w) continue;
        if (tokens.some((t) => w === t || w.startsWith(t) || t.startsWith(w))) {
          best = i;
          break;
        }
      }
    }
    if (best === -1) {
      // Distribute leftover citations evenly so they still appear in-line.
      const target = Math.floor(((sIdx + 1) / (sources.length + 1)) * words.length);
      best = target;
      while (used.has(best) && best < words.length - 1) best += 1;
    }
    used.add(best);
    const arr = map.get(best) ?? [];
    arr.push(sIdx);
    map.set(best, arr);
  });

  return map;
}

interface Bookmark {
  label: string;
  time: number;
  wordIndex: number;
}

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Build a small table of contents from the transcript by splitting on
 * sentence-ending punctuation and picking evenly-spaced bookmarks.
 */
function buildBookmarks(words: TranscriptWord[]): Bookmark[] {
  if (words.length === 0) return [];
  const sentenceStarts: { index: number; time: number; text: string }[] = [];
  let pendingStart = 0;
  let buf: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (buf.length === 0) pendingStart = i;
    buf.push(words[i].text);
    if (/[.!?]$/.test(words[i].text) || i === words.length - 1) {
      sentenceStarts.push({
        index: pendingStart,
        time: words[pendingStart].start,
        text: buf.join(" "),
      });
      buf = [];
    }
  }
  if (sentenceStarts.length === 0) return [];

  // Pick up to 6 evenly-distributed sentences as bookmarks.
  const target = Math.min(6, sentenceStarts.length);
  const step = sentenceStarts.length / target;
  const picks: Bookmark[] = [];
  for (let i = 0; i < target; i++) {
    const s = sentenceStarts[Math.floor(i * step)];
    const label = s.text.replace(/\s+/g, " ").trim().slice(0, 48);
    picks.push({
      label: label.length === 48 ? label + "…" : label,
      time: s.time,
      wordIndex: s.index,
    });
  }
  return picks;
}

export function Transcript({ words, fallbackText, elapsed, onSeek }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const wordRefs = useRef<Map<number, HTMLSpanElement>>(new Map());

  const [query, setQuery] = useState("");
  const [matchCursor, setMatchCursor] = useState(0);

  const activeIndex = useMemo(() => {
    if (!words || words.length === 0) return -1;
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

  const matches = useMemo(() => {
    if (!words || !query.trim()) return [] as number[];
    const q = query.trim().toLowerCase();
    const out: number[] = [];
    // Match across word boundaries by joining a small window.
    const tokens = q.split(/\s+/);
    for (let i = 0; i <= words.length - tokens.length; i++) {
      let ok = true;
      for (let j = 0; j < tokens.length; j++) {
        const w = words[i + j].text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
        if (!w.includes(tokens[j])) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(i);
    }
    return out;
  }, [words, query]);

  // Reset cursor when query changes; jump to the closest match to elapsed.
  useEffect(() => {
    if (matches.length === 0) {
      setMatchCursor(0);
      return;
    }
    if (!words) return;
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < matches.length; i++) {
      const t = words[matches[i]].start;
      const d = Math.abs(t - elapsed);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    setMatchCursor(best);
    // Auto-seek to the closest match on a new search.
    const target = words[matches[best]].start;
    onSeek?.(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const matchSet = useMemo(() => {
    if (!words || matches.length === 0) return new Set<number>();
    const tokens = query.trim().split(/\s+/).length;
    const s = new Set<number>();
    for (const start of matches) {
      for (let k = 0; k < tokens; k++) s.add(start + k);
    }
    return s;
  }, [matches, query, words]);

  const bookmarks = useMemo(() => (words ? buildBookmarks(words) : []), [words]);

  // Auto-scroll the active or focused match word into view.
  useEffect(() => {
    const targetIdx =
      matches.length > 0 && words ? matches[matchCursor] : activeIndex;
    const el = wordRefs.current.get(targetIdx);
    const container = containerRef.current;
    if (!el || !container) return;
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    if (elRect.top < cRect.top + 24 || elRect.bottom > cRect.bottom - 24) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex, matchCursor, matches, words]);

  function gotoMatch(delta: number) {
    if (matches.length === 0 || !words) return;
    const next = (matchCursor + delta + matches.length) % matches.length;
    setMatchCursor(next);
    onSeek?.(words[matches[next]].start);
  }

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

  const focusedMatchIdx = matches.length > 0 ? matches[matchCursor] : -1;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/50 p-3 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Transcript
        </span>
        <div className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-2 py-1">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-28 bg-transparent text-xs outline-none placeholder:text-muted-foreground md:w-40"
            aria-label="Search transcript"
          />
          {query && (
            <>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {matches.length === 0
                  ? "0/0"
                  : `${matchCursor + 1}/${matches.length}`}
              </span>
              <button
                onClick={() => gotoMatch(-1)}
                disabled={matches.length === 0}
                className="grid h-4 w-4 place-items-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Previous match"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => gotoMatch(1)}
                disabled={matches.length === 0}
                className="grid h-4 w-4 place-items-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Next match"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                onClick={() => setQuery("")}
                className="grid h-4 w-4 place-items-center rounded text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {bookmarks.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <BookmarkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
          {bookmarks.map((b, i) => {
            const isActive = activeIndex >= b.wordIndex;
            return (
              <button
                key={i}
                onClick={() => onSeek?.(b.time)}
                title={b.label}
                className={
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono tabular-nums transition " +
                  (isActive
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground")
                }
              >
                {formatTime(b.time)}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        className="max-h-48 overflow-y-auto text-sm leading-relaxed"
      >
        <p className="text-foreground/80">
          {words.map((w, i) => {
            const isActive = i === activeIndex;
            const isPast = i < activeIndex;
            const isMatch = matchSet.has(i);
            const isFocusedMatch =
              focusedMatchIdx >= 0 &&
              i >= focusedMatchIdx &&
              i < focusedMatchIdx + (query.trim().split(/\s+/).length || 1);
            return (
              <span key={i}>
                <span
                  ref={(el) => {
                    if (el) wordRefs.current.set(i, el);
                    else wordRefs.current.delete(i);
                  }}
                  onClick={() => onSeek?.(w.start)}
                  className={
                    "cursor-pointer rounded px-0.5 transition-colors " +
                    (isFocusedMatch
                      ? "bg-primary/50 text-foreground"
                      : isMatch
                        ? "bg-primary/20 text-foreground"
                        : isActive
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
    </div>
  );
}
