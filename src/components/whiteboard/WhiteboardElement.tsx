import { BlockMath, InlineMath } from "react-katex";
import type { WhiteboardEvent } from "@/lib/whiteboard-types";
import { useMemo } from "react";

interface Props {
  event: WhiteboardEvent;
  selectedIndex: number | null; // 1-based position in selection, or null
  onToggleSelect: (additive: boolean) => void;
}

function summarize(e: WhiteboardEvent): string {
  switch (e.type) {
    case "title": return e.text;
    case "bullet": return e.text;
    case "definition": return `${e.term}: ${e.definition}`;
    case "equation": return e.caption ?? e.latex;
    case "diagram": return `${e.shape} diagram${e.caption ? `: ${e.caption}` : ""}`;
    case "image": return e.caption ?? e.image_prompt;
    case "code": return e.caption ?? `${e.language} snippet`;
    case "annotation": return e.text;
    case "clear": return "(clear)";
  }
}

export function WhiteboardElement({ event, selectedIndex, onToggleSelect }: Props) {
  const selected = selectedIndex !== null;
  const wrapper = (children: React.ReactNode, extra?: string) => (
    <button
      type="button"
      onClick={(ev) => onToggleSelect(ev.shiftKey || ev.metaKey || ev.ctrlKey)}
      title="Click to select • Shift/Cmd-click to add to selection"
      data-element-id={event.id}
      className={`group relative block w-full rounded-xl text-left transition ${
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-board bg-primary/5"
          : "hover:ring-2 hover:ring-board-accent-2/30 hover:ring-offset-2 hover:ring-offset-board"
      } ${extra ?? ""}`}
    >
      {selected && (
        <span className="absolute -left-2 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground shadow-md ring-2 ring-board">
          {selectedIndex}
        </span>
      )}
      {children}
    </button>
  );

  if (event.type === "title") {
    return wrapper(
      <h2 className="ink-in font-display text-3xl text-board-foreground md:text-4xl">{event.text}</h2>,
      "px-2 py-1"
    );
  }

  if (event.type === "bullet") {
    return wrapper(
      <div className="ink-in flex items-start gap-3 px-3 py-1.5">
        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-board-accent" />
        <span className="text-base text-board-foreground md:text-lg">{event.text}</span>
      </div>
    );
  }

  if (event.type === "definition") {
    return wrapper(
      <div className="ink-in rounded-xl border-l-4 border-board-accent-2 bg-[color-mix(in_oklab,var(--board-accent-2)_8%,transparent)] px-4 py-3">
        <div className="font-display text-xl italic text-board-foreground">{event.term}</div>
        <div className="mt-1 text-sm text-board-ink/85">{event.definition}</div>
      </div>
    );
  }

  if (event.type === "equation") {
    return wrapper(
      <div className="ink-in flex flex-col items-center px-3 py-3">
        <div className="text-board-ink"><BlockMath math={event.latex} /></div>
        {event.caption && <div className="mt-1.5 text-xs text-board-ink/60">{event.caption}</div>}
      </div>
    );
  }

  if (event.type === "image") {
    return wrapper(
      <div className="ink-in space-y-1.5 px-2">
        <div className="aspect-[16/10] w-full overflow-hidden rounded-lg border border-board-grid bg-board-grid/40">
          {event.url ? (
            <img src={event.url} alt={event.caption ?? event.image_prompt} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs italic text-board-ink/50">
              {event.image_prompt}
            </div>
          )}
        </div>
        {event.caption && <div className="text-xs text-board-ink/60">{event.caption}</div>}
      </div>
    );
  }

  if (event.type === "code") {
    return wrapper(
      <div className="ink-in space-y-1.5 px-2">
        <pre className="overflow-x-auto rounded-lg bg-board-foreground/95 p-3 font-mono text-xs text-board"><code>{event.code}</code></pre>
        {event.caption && <div className="text-xs text-board-ink/60">{event.caption}</div>}
      </div>
    );
  }

  if (event.type === "annotation") {
    return wrapper(
      <div className="ink-in inline-flex items-center gap-2 rounded-full bg-board-accent/15 px-3 py-1 text-sm text-board-accent">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 9l-9 9-3 1 1-3 9-9 2 2zM13 6l5 5" />
        </svg>
        <span className="italic">{event.text}</span>
      </div>
    );
  }

  if (event.type === "diagram") return wrapper(<DiagramRenderer event={event} />);

  return null;
}

function DiagramRenderer({ event }: { event: Extract<WhiteboardEvent, { type: "diagram" }> }) {
  // Layout positions per shape
  const layout = useMemo(() => computeLayout(event), [event]);

  return (
    <div className="ink-in px-2 py-2">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full h-auto">
        <defs>
          <marker id={`arrow-${event.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-board-ink)" />
          </marker>
        </defs>
        {/* Edges */}
        {layout.edges.map((e, i) => (
          <g key={i}>
            <line
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="var(--color-board-ink)"
              strokeWidth="1.5"
              markerEnd={`url(#arrow-${event.id})`}
              className="draw-stroke"
              style={{ ["--dash" as never]: 600 }}
            />
            {e.label && (
              <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 6} textAnchor="middle" fontSize="10" fill="var(--color-board-ink)" opacity="0.7">
                {e.label}
              </text>
            )}
          </g>
        ))}
        {/* Nodes */}
        {layout.nodes.map((n) => (
          <g key={n.id}>
            <rect
              x={n.x - n.w / 2}
              y={n.y - n.h / 2}
              width={n.w}
              height={n.h}
              rx="10"
              fill="var(--color-board)"
              stroke="var(--color-board-ink)"
              strokeWidth="1.4"
            />
            <text x={n.x} y={n.y - (n.sub ? 4 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="600" fill="var(--color-board-foreground)">
              {n.label}
            </text>
            {n.sub && (
              <text x={n.x} y={n.y + 12} textAnchor="middle" fontSize="10" fill="var(--color-board-ink)" opacity="0.7">
                {n.sub}
              </text>
            )}
          </g>
        ))}
      </svg>
      {event.caption && <div className="mt-1.5 text-center text-xs italic text-board-ink/60">{event.caption}</div>}
    </div>
  );
}

interface LaidOut {
  width: number;
  height: number;
  nodes: { id: string; label: string; sub?: string; x: number; y: number; w: number; h: number }[];
  edges: { x1: number; y1: number; x2: number; y2: number; label?: string }[];
}

function computeLayout(event: Extract<WhiteboardEvent, { type: "diagram" }>): LaidOut {
  const nodes = event.nodes;
  const W = 560;
  const NW = 130;
  const NH = 54;

  if (event.shape === "flow") {
    const gap = (W - NW * nodes.length) / (nodes.length + 1);
    const y = 80;
    const positioned = nodes.map((n, i) => ({ ...n, x: gap + NW / 2 + i * (NW + gap), y, w: NW, h: NH }));
    const idx = (id: string) => positioned.find((n) => n.id === id);
    const edges = (event.edges ?? []).flatMap((e) => {
      const a = idx(e.from), b = idx(e.to);
      if (!a || !b) return [];
      return [{ x1: a.x + a.w / 2, y1: a.y, x2: b.x - b.w / 2, y2: b.y, label: e.label }];
    });
    return { width: W, height: 160, nodes: positioned, edges };
  }

  if (event.shape === "cycle") {
    const cx = W / 2, cy = 180, r = 120;
    const positioned = nodes.map((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      return { ...n, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, w: NW, h: NH };
    });
    const edges = positioned.map((a, i) => {
      const b = positioned[(i + 1) % positioned.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ox = (dx / len) * (NW / 2), oy = (dy / len) * (NH / 2);
      return { x1: a.x + ox, y1: a.y + oy, x2: b.x - ox, y2: b.y - oy };
    });
    return { width: W, height: 360, nodes: positioned, edges };
  }

  if (event.shape === "tree") {
    const root = nodes[0];
    const children = nodes.slice(1);
    const cy1 = 60, cy2 = 200;
    const positioned = [
      { ...root, x: W / 2, y: cy1, w: NW, h: NH },
      ...children.map((n, i) => ({
        ...n,
        x: ((i + 1) * W) / (children.length + 1),
        y: cy2,
        w: NW,
        h: NH,
      })),
    ];
    const edges = (event.edges ?? []).flatMap((e) => {
      const a = positioned.find((n) => n.id === e.from);
      const b = positioned.find((n) => n.id === e.to);
      if (!a || !b) return [];
      return [{ x1: a.x, y1: a.y + a.h / 2, x2: b.x, y2: b.y - b.h / 2, label: e.label }];
    });
    return { width: W, height: 260, nodes: positioned, edges };
  }

  if (event.shape === "compare") {
    const half = Math.ceil(nodes.length / 2);
    const left = nodes.slice(0, half);
    const right = nodes.slice(half);
    const positioned = [
      ...left.map((n, i) => ({ ...n, x: W * 0.27, y: 60 + i * 70, w: NW * 1.1, h: NH })),
      ...right.map((n, i) => ({ ...n, x: W * 0.73, y: 60 + i * 70, w: NW * 1.1, h: NH })),
    ];
    return { width: W, height: 60 + Math.max(left.length, right.length) * 70 + 20, nodes: positioned, edges: [] };
  }

  // axis
  const cx = 50, cy = 240;
  const positioned = nodes.map((n, i) => ({
    ...n,
    x: cx + 80 + (i + 1) * 60,
    y: cy - 40 - (i % 4) * 35,
    w: 70,
    h: 36,
  }));
  return {
    width: W,
    height: 280,
    nodes: positioned,
    edges: [
      { x1: cx, y1: cy, x2: W - 20, y2: cy }, // x-axis
      { x1: cx, y1: cy, x2: cx, y2: 20 },     // y-axis
    ],
  };
}

export { summarize };
