import { Pause, Play, SkipBack, SkipForward, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  elapsed: number;
  duration: number;
  playing: boolean;
  rate: number;
  loading?: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (s: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onRateChange: (r: number) => void;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function TransportBar({
  elapsed,
  duration,
  playing,
  rate,
  loading,
  canPrev,
  canNext,
  onPlay,
  onPause,
  onSeek,
  onPrev,
  onNext,
  onRateChange,
}: Props) {
  const max = duration > 0 ? duration : 1;
  const value = Math.min(elapsed, max);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 backdrop-blur md:px-4">
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30"
        aria-label="Previous section"
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={playing ? onPause : onPlay}
        disabled={loading}
        className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
        aria-label={playing ? "Pause" : "Play"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      <button
        onClick={onNext}
        disabled={!canNext}
        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30"
        aria-label="Next section"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>

      <div className="flex flex-1 items-center gap-3">
        <span className="w-10 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatTime(value)}
        </span>
        <Slider
          value={[value]}
          max={max}
          step={0.1}
          onValueChange={(v) => onSeek(v[0] ?? 0)}
          className="flex-1"
          aria-label="Scrub timeline"
        />
        <span className="w-10 font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] text-foreground transition hover:bg-secondary/70">
          {rate}x
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[5rem]">
          {RATES.map((r) => (
            <DropdownMenuItem
              key={r}
              onSelect={() => onRateChange(r)}
              className={r === rate ? "font-semibold" : ""}
            >
              {r}x
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
