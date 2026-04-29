import { useEffect, useRef, useState } from "react";

/**
 * Browser SpeechSynthesis tutor voice. Works without any API key.
 * Returns speaking state + a rough amplitude estimate for the orb pulse.
 * Can be swapped for ElevenLabs Conversational AI later.
 */
export function useTutorSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onEndRef = useRef<(() => void) | null>(null);
  const ampTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      if (ampTimerRef.current) window.clearInterval(ampTimerRef.current);
    };
  }, []);

  function pickVoice(): SpeechSynthesisVoice | undefined {
    if (typeof window === "undefined") return undefined;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => /samantha|jenny|aria|natural|google.*english/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith("en")) ??
      voices[0]
    );
  }

  function speak(text: string, onEnd?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 1.0;
    u.onstart = () => {
      setSpeaking(true);
      if (ampTimerRef.current) window.clearInterval(ampTimerRef.current);
      ampTimerRef.current = window.setInterval(() => {
        setAmplitude(0.3 + Math.random() * 0.5);
      }, 90);
    };
    u.onend = () => {
      setSpeaking(false);
      setAmplitude(0);
      if (ampTimerRef.current) window.clearInterval(ampTimerRef.current);
      onEndRef.current?.();
    };
    u.onerror = () => {
      setSpeaking(false);
      setAmplitude(0);
      if (ampTimerRef.current) window.clearInterval(ampTimerRef.current);
      onEndRef.current?.();
    };
    onEndRef.current = onEnd ?? null;
    utterRef.current = u;
    window.speechSynthesis.speak(u);
  }

  function stop() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setAmplitude(0);
    if (ampTimerRef.current) window.clearInterval(ampTimerRef.current);
  }

  function pause() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.pause();
  }

  function resume() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.resume();
  }

  return { speak, stop, pause, resume, speaking, amplitude };
}
