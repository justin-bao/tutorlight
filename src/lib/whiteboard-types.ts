// Shared whiteboard event types. Used by the LLM tool schema, the DB jsonb
// column, and the renderer.

export type WhiteboardEvent =
  | { id: string; at: number; type: "title"; text: string }
  | { id: string; at: number; type: "bullet"; text: string; under?: string }
  | { id: string; at: number; type: "definition"; term: string; definition: string }
  | { id: string; at: number; type: "equation"; latex: string; caption?: string }
  | {
      id: string;
      at: number;
      type: "diagram";
      shape: "flow" | "cycle" | "tree" | "compare" | "axis";
      nodes: { id: string; label: string; sub?: string }[];
      edges?: { from: string; to: string; label?: string }[];
      caption?: string;
    }
  | { id: string; at: number; type: "image"; image_prompt: string; caption?: string; url?: string }
  | { id: string; at: number; type: "code"; language: string; code: string; caption?: string }
  | { id: string; at: number; type: "annotation"; targetId: string; text: string }
  | { id: string; at: number; type: "clear" };

export type WhiteboardEventType = WhiteboardEvent["type"];

export interface LessonSectionPayload {
  heading: string;
  script: string;
  estimated_duration_s: number;
  whiteboard: WhiteboardEvent[];
  sources: { title: string; url: string }[];
}

export interface LessonPayload {
  title: string;
  summary: string;
  sections: LessonSectionPayload[];
}
