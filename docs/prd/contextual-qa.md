# PRD — Contextual Q&A

## Problem

Learners always have follow-up questions, and those questions are usually about *something specific that's on screen right now*. Generic chat loses that context and answers in the abstract.

## Users & jobs

- **Confused learner:** "Wait, what does that variable mean?" while pointing at an equation.
- **Curious learner:** "Where is this used in the real world?" after a definition appears.
- **Skeptical learner:** "Is this still true in 2026?"

## Goals

- Let users ask questions that automatically include the current section, the visible whiteboard state, and any pinned element as context.
- Persist the conversation per lesson for later review.
- Keep answers grounded — cite or reference the on-screen content.

## Non-goals

- Cross-lesson memory.
- Voice input (today).
- Multi-turn agentic tool use.

## Experience

- Q&A panel sits beside or below the lesson.
- User can click a whiteboard element to "pin" it; the pin chip shows above the input.
- User types a question; the request includes section id, visible whiteboard items, and the pinned element id.
- The tutor's spoken answer plays via browser SpeechSynthesis (ephemeral, not stored).
- Chat history persists in `lesson_messages`.

## Functional requirements

- `lesson_messages` table: `lesson_id`, `section_id`, `role`, `content`, `pinned_element_id`, `whiteboard_addendum`, `created_at`. RLS scoped via `has_lesson_access`.
- Backend `/api/ask` endpoint receives context payload, calls AI, returns answer.
- Answers can include a `whiteboard_addendum` — additional elements appended to the board to illustrate the answer.
- Pin state is local UI; the pinned id is sent with the question.

## Quality bar

- Answers reference the pinned/visible elements when relevant (qualitative eval).
- Q&A never blocks lesson playback.
- Chat history reloads correctly per section on refresh.

## Dependencies

- Lesson generation + whiteboard renderer (for pinning).
- AI provider (`AI_API_KEY`).
- Browser SpeechSynthesis for tutor reply voice.

## Open questions

- Should answers also stream through ElevenLabs for voice consistency?
- Should pinned elements persist across sections?
- Add "suggested questions" per section?
