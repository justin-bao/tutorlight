import { describe, expect, it } from "vitest";
import { summarize } from "@/components/whiteboard/WhiteboardElement";
import type { WhiteboardEvent } from "@/lib/whiteboard-types";

describe("summarize", () => {
  it("summarizes definition events with the term first", () => {
    const event: WhiteboardEvent = {
      id: "def-1",
      at: 4,
      type: "definition",
      term: "Photosynthesis",
      definition: "Plants turn light into stored chemical energy.",
    };

    expect(summarize(event)).toBe("Photosynthesis: Plants turn light into stored chemical energy.");
  });

  it("prefers captions for media-like whiteboard events", () => {
    const equation: WhiteboardEvent = {
      id: "eq-1",
      at: 8,
      type: "equation",
      latex: "E=mc^2",
      caption: "Mass-energy equivalence",
    };

    expect(summarize(equation)).toBe("Mass-energy equivalence");
  });
});
