## Revised vision

The **virtual whiteboard** is the centerpiece of every lesson. It's a live, dynamic canvas that the AI tutor "draws on" as they teach — building up diagrams, equations, labeled illustrations, key terms, and reference images step by step in sync with what they're saying. Learners can also point at, reference, and ask about anything on the whiteboard.

Think: a calm studio with a tutor speaking, and a generous whiteboard that fills with hand-drawn-feeling visuals as the lesson unfolds.

## Layout

```
┌─────────────────────────────┬──────────────┐
│                             │  Outline     │
│         WHITEBOARD          │  • Section 1 │
│   (large, center stage)     │  • Section 2◄│
│                             │  • Section 3 │
│   diagrams build in as      │              │
│   tutor speaks              ├──────────────┤
│                             │  Tutor       │
│                             │  (avatar orb │
│                             │   + voice)   │
├─────────────────────────────┴──────────────┤
│  Ask a question…  [mic]  [send]            │
└────────────────────────────────────────────┘
```

The avatar is smaller and to the side — a presence, not the spectacle. The whiteboard is the spectacle.

## How the whiteboard works

Each lesson section's generated content includes a **whiteboard script**: an ordered list of "draw events" the tutor performs while speaking. Event types:

- `title` — heading lands on the board
- `bullet` — labeled point appears, optionally beneath a heading
- `definition` — term + definition card
- `equation` — rendered math (KaTeX)
- `diagram` — generated SVG diagram (boxes, arrows, flow, cycle, tree, axis) with labels — described declaratively by the LLM, rendered by a typed React component
- `image` — generated or web image with caption
- `code` — syntax-highlighted snippet
- `annotation` — arrow/circle/highlight pointing to a previous element (referenced by id)
- `clear` — wipe the board for the next sub-topic

Each event has a `at` timestamp (in seconds from section start) so it appears in sync with the tutor's voice. Events animate in with a subtle ink/spring entrance, giving the "being drawn" feel.

The whiteboard accumulates within a section, then transitions on section change. Users can **scroll back through previous sections' boards** (read-only history).

### "Reference this" interaction

Every element on the whiteboard is hoverable. Clicking one **pins it as context** for the next question — the chip appears in the question input ("About: *Krebs cycle diagram*"). The Q&A edge function then sends that element's data along with the question so the tutor's answer is grounded in exactly what the user pointed at.

## LLM contract

`generate-lesson` produces structured JSON via tool calling:

```ts
{
  title, summary,
  sections: [{
    heading,
    script,                   // what the tutor says
    estimated_duration_s,     // for pacing the whiteboard timeline
    whiteboard: [             // ordered, with `at` seconds
      { id, at, type: "title" | "bullet" | ... , ...payload }
    ],
    sources: [{ title, url }]
  }]
}
```

The LLM is prompted to think of itself as a teacher planning what they'll write on the board while speaking — every key idea in the script should map to a whiteboard event.

For images inside the whiteboard, the LLM emits an `image_prompt`; on the server we generate via Lovable AI's image model (`google/gemini-3-flash-image-preview`) and store the result.

## Tutor sync

ElevenLabs Conversational AI speaks the section script. We start a section-local clock when the agent begins speaking, and the whiteboard component plays back its events against that clock. If the user interrupts to ask a question:

- Whiteboard pauses (events freeze where they are).
- Agent overrides switch to "answer mode" with the lesson + section + pinned-element context.
- Optional: the tutor can add 1–2 *ad-hoc* whiteboard events during the answer (the Q&A function may return a small `whiteboard_addendum` array — annotation, definition, or quick diagram).
- Resume button continues the section from where it paused.

## Tech additions vs the prior plan

- **KaTeX** for equations
- **Custom SVG diagram renderer** (`<DiagramFlow>`, `<DiagramCycle>`, `<DiagramAxis>`, etc.) driven by declarative JSON — no third-party diagramming dep needed for v1
- **Whiteboard timeline engine** — small hook that maps elapsed seconds → visible events
- **Image generation** via Lovable AI for whiteboard images, stored in Cloud storage
- DB additions: `lesson_sections.whiteboard` jsonb, `lesson_messages.pinned_element_id` text

## Updated build order

1. Cloud + auth + DB schema (with whiteboard field)
2. Design system + landing prompt page
3. `generate-lesson` edge function with whiteboard event schema
4. Whiteboard renderer: layout, element components (title/bullet/definition/equation/diagram/image/code/annotation), entrance animations, hover/pin interaction
5. Lesson view: outline + whiteboard + small avatar + question bar
6. ElevenLabs token function + `useConversation` wired to section scripts
7. Timeline engine syncing whiteboard events to the speaking tutor
8. `lesson-qa` function with pinned-element grounding + optional `whiteboard_addendum`
9. "My lessons" page + polish

## Secrets needed (later, when we get to the integration step)

- `ELEVENLABS_API_KEY` + an Agent ID created in their ElevenLabs dashboard — I'll walk the user through this when we reach step 6.
- `LOVABLE_API_KEY` — auto-provisioned with Cloud.

Ready to start building from step 1 (Cloud + design system + landing) on approval. The whiteboard is the centerpiece — I'll spend extra craft on its element components and entrance animations so it really feels like a living teaching surface.