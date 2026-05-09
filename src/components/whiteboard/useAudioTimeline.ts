import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Audio-driven section timeline. When `audioUrl` is provided, an internal
 * <audio> element drives `elapsed`. When it's null (still synthesizing), it
 * falls back to a wall-clock timer so the whiteboard timeline still progresses
 * (using browser TTS audio if any).
 */
export function useAudioTimeline(audioUrl: string | null, fallbackDurationMs: number | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (audioRef.current === null && typeof window !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }

  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState<number>((fallbackDurationMs ?? 0) / 1000);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);

  // Fallback (no audio) wall-clock
  const fallbackStart = useRef<number | null>(null);
  const fallbackAccum = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Reset when source changes
  useEffect(() => {
    const audio = audioRef.current;
    setElapsed(0);
    setPlaying(false);
    fallbackAccum.current = 0;
    fallbackStart.current = null;
    if (!audio) return;

    if (audioUrl) {
      audio.src = audioUrl;
      audio.currentTime = 0;
      audio.playbackRate = rate;
    } else {
      audio.removeAttribute("src");
      audio.load();
      setDuration((fallbackDurationMs ?? 0) / 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, fallbackDurationMs]);

  // Audio element listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function onTime() {
      setElapsed(audio!.currentTime);
    }
    function onMeta() {
      if (Number.isFinite(audio!.duration)) setDuration(audio!.duration);
    }
    function onPlay() {
      setPlaying(true);
    }
    function onPause() {
      setPlaying(false);
    }
    function onEnded() {
      setPlaying(false);
    }
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Fallback timer when no audio
  useEffect(() => {
    if (audioUrl) return; // audio drives elapsed
    if (!playing) return;
    function tick() {
      if (fallbackStart.current !== null) {
        const now = performance.now();
        setElapsed(fallbackAccum.current + ((now - fallbackStart.current) / 1000) * rate);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    fallbackStart.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fallbackStart.current !== null) {
        fallbackAccum.current += ((performance.now() - fallbackStart.current) / 1000) * rate;
        fallbackStart.current = null;
      }
    };
  }, [playing, audioUrl, rate]);

  function play() {
    const audio = audioRef.current;
    if (audioUrl && audio) {
      audio.play().catch(() => setPlaying(false));
    } else {
      setPlaying(true);
    }
  }
  function pause() {
    const audio = audioRef.current;
    if (audioUrl && audio) audio.pause();
    else setPlaying(false);
  }
  function seek(s: number) {
    const target = Math.max(0, Math.min(duration || s, s));
    const audio = audioRef.current;
    if (audioUrl && audio) {
      audio.currentTime = target;
      setElapsed(target);
    } else {
      fallbackAccum.current = target;
      fallbackStart.current = playing ? performance.now() : null;
      setElapsed(target);
    }
  }
  function setRate(r: number) {
    setRateState(r);
    const audio = audioRef.current;
    if (audio) audio.playbackRate = r;
  }
  function reset() {
    seek(0);
    pause();
  }

  // Effective duration: prefer real audio duration, fall back to provided.
  const effectiveDuration = useMemo(() => {
    if (duration > 0) return duration;
    return (fallbackDurationMs ?? 0) / 1000;
  }, [duration, fallbackDurationMs]);

  return {
    elapsed,
    duration: effectiveDuration,
    playing,
    play,
    pause,
    seek,
    reset,
    rate,
    setRate,
    audioEl: audioRef.current,
  };
}
