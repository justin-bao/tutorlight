# PRD — Dynamic Whiteboard

## Problem

Spoken narration alone is hard to follow for technical topics. Static slides are too rigid. Learners need visuals that *appear in time with the explanation* — so the eye lands on the right thing exactly when the tutor mentions it.

## Users & jobs

- **Visual learners:** "Show me what you mean."
- **Technical learners:** Need equations, diagrams, code, definitions — not just prose.

## Goals

- Render a tutor-style whiteboard whose contents appear progressively, in sync with the narration.
- Support a fixed vocabulary of element types (titles, bullets, definitions, equations, diagrams, images, code, annotations, clear).
- Every state is deterministic from `(events, elapsed)` so scrubbing works.

## Non-goals

- Free-form drawing.
- User-editable whiteboard.
- Real-time collaboration.

## Experience

- As a section plays, elements fade/slide in at their `at` timestamp.
- A `clear` event wipes the board for a new beat.
- Scrubbing the timeline instantly recomputes which elements are visible.
- Users can click an element to "pin" it as context for Q&A.

## Functional requirements

- Renderer is a pure function of `(events[], elapsedSeconds)`.
- Element schema is shared across AI output, DB storage, and renderer via `src/lib/whiteboard-types.ts`.
- Each element has a stable `id` for selection and pinning.
- Layout adapts to viewport (desktop and mobile).

## Quality bar

- Unit tests in `tests/integration/WhiteboardElement.test.tsx` and `tests/unit/whiteboard-summary.test.ts`.
- Whiteboard never throws on partial/malformed events — it skips and logs.

## Dependencies

- `lesson_sections.whiteboard` jsonb column.
- Audio timeline (or fallback wall-clock) to provide `elapsed`.

## Open questions

- Should diagrams be SVG primitives or AI-generated images?
- Persist user pins across sessions?
