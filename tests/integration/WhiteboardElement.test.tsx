import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WhiteboardElement } from "@/components/whiteboard/WhiteboardElement";
import type { WhiteboardEvent } from "@/lib/whiteboard-types";

describe("WhiteboardElement integration", () => {
  it("renders a bullet as a selectable whiteboard control", () => {
    const onToggleSelect = vi.fn();
    const event: WhiteboardEvent = {
      id: "bullet-1",
      at: 2,
      type: "bullet",
      text: "Start with the learner's current mental model.",
    };

    render(<WhiteboardElement event={event} selectedIndex={null} onToggleSelect={onToggleSelect} />);

    const button = screen.getByRole("button", {
      name: /start with the learner's current mental model/i,
    });
    expect(button).toHaveAttribute("data-element-id", "bullet-1");

    fireEvent.click(button);
    expect(onToggleSelect).toHaveBeenCalledWith(false);

    fireEvent.click(button, { shiftKey: true });
    expect(onToggleSelect).toHaveBeenLastCalledWith(true);
  });

  it("renders selected diagram nodes and captions together", () => {
    const event: WhiteboardEvent = {
      id: "diagram-1",
      at: 5,
      type: "diagram",
      shape: "flow",
      caption: "A lesson-generation pipeline",
      nodes: [
        { id: "topic", label: "Topic" },
        { id: "plan", label: "Plan" },
        { id: "teach", label: "Teach" },
      ],
      edges: [
        { from: "topic", to: "plan", label: "shapes" },
        { from: "plan", to: "teach", label: "guides" },
      ],
    };

    render(<WhiteboardElement event={event} selectedIndex={2} onToggleSelect={vi.fn()} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Topic")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Teach")).toBeInTheDocument();
    expect(screen.getByText("A lesson-generation pipeline")).toBeInTheDocument();
  });
});
