import { useMemo } from "react";
import type { WhiteboardEvent } from "@/lib/whiteboard-types";
import { WhiteboardElement } from "./WhiteboardElement";

interface Props {
  events: WhiteboardEvent[];
  elapsed: number; // seconds since section start
  pinnedId: string | null;
  onPin: (id: string | null) => void;
  sectionHeading: string;
}

export function Whiteboard({ events, elapsed, pinnedId, onPin, sectionHeading }: Props) {
  // Filter events that should be visible at this elapsed time, respecting "clear"
  const visible = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.at - b.at);
    let buffer: WhiteboardEvent[] = [];
    for (const e of sorted) {
      if (e.at > elapsed) break;
      if (e.type === "clear") {
        buffer = [];
      } else {
        buffer.push(e);
      }
    }
    return buffer;
  }, [events, elapsed]);

  return (
    <div className="board-paper relative h-full w-full overflow-hidden rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-black/10">
      {/* Subtle border frame */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-board-ink/10" />
      <div className="absolute right-4 top-3 font-display text-xs italic text-board-ink/40">
        {sectionHeading}
      </div>

      <div
        className="relative h-full overflow-y-auto px-6 py-8 md:px-10 md:py-10"
        onClick={(e) => {
          if (e.target === e.currentTarget) onPin(null);
        }}
      >
        {visible.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm italic text-board-ink/40">
            The board is clean. The tutor will begin shortly…
          </div>
        )}
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {visible.map((e) => (
            <WhiteboardElement
              key={e.id}
              event={e}
              pinned={pinnedId === e.id}
              onPin={() => onPin(pinnedId === e.id ? null : e.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
