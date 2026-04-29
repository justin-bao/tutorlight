import { useEffect, useRef, useState } from "react";

/**
 * Drives a section-local clock that advances when "playing" and is pausable.
 * Returns elapsed seconds since play started (cumulative across pauses).
 */
export function useSectionTimeline(sectionId: string | null, autoplay = true) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const startRef = useRef<number | null>(null);
  const accumRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Reset whenever section changes
  useEffect(() => {
    setElapsed(0);
    accumRef.current = 0;
    startRef.current = null;
    setPlaying(autoplay);
  }, [sectionId, autoplay]);

  useEffect(() => {
    function tick() {
      if (startRef.current !== null) {
        const now = performance.now();
        setElapsed(accumRef.current + (now - startRef.current) / 1000);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    if (playing) {
      startRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (startRef.current !== null) {
        accumRef.current += (performance.now() - startRef.current) / 1000;
        startRef.current = null;
      }
    };
  }, [playing]);

  return {
    elapsed,
    playing,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    reset: () => {
      accumRef.current = 0;
      startRef.current = playing ? performance.now() : null;
      setElapsed(0);
    },
    seek: (s: number) => {
      accumRef.current = s;
      startRef.current = playing ? performance.now() : null;
      setElapsed(s);
    },
  };
}
