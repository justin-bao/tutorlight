import { Sparkles } from "lucide-react";

interface Props {
  speaking: boolean;
  thinking?: boolean;
  amplitude?: number; // 0..1
}

export function TutorOrb({ speaking, thinking = false, amplitude = 0 }: Props) {
  const scale = 1 + Math.min(0.18, amplitude * 0.5);
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="orb-breathe absolute inset-4 rounded-full bg-gradient-to-br from-primary/40 via-accent/20 to-primary/10 blur-2xl" />
      <div
        className="relative grid place-items-center rounded-full bg-gradient-to-br from-primary via-primary to-accent shadow-2xl shadow-primary/40 transition-transform duration-100"
        style={{
          width: "clamp(80px, 14vh, 140px)",
          height: "clamp(80px, 14vh, 140px)",
          transform: `scale(${scale})`,
        }}
      >
        <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-white/20 to-transparent" />
        <Sparkles className="relative h-7 w-7 text-primary-foreground" />
      </div>
      <div className="absolute bottom-0 text-[10px] uppercase tracking-widest text-muted-foreground">
        {thinking ? "thinking" : speaking ? "speaking" : "ready"}
      </div>
    </div>
  );
}
