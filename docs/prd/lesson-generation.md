# PRD — Lesson Generation

## Problem

Learners want a structured explanation of a topic, not a chat transcript or a search result list. They need something that *starts*, *builds*, and *ends* — with a clear arc.

## Users & jobs

- **Curious learner:** "Teach me what a Kalman filter is in 5 minutes."
- **Student:** "I have a quiz tomorrow on the Krebs cycle — give me the highlights."
- **Professional:** "Onboard me to OAuth 2.0 PKCE."

## Goals

- Turn a freeform topic into a structured, multi-section lesson in <30s.
- Output is deterministic in shape (validated schema) so the renderer never breaks.
- Each section is short enough to listen to in 60–120s.
- Sources are included where applicable for trust.

## Non-goals

- Long-form (>10 section) lessons.
- Editing the generated lesson in place.
- Generating images from scratch (we reference URLs only).

## Experience

1. User types a topic on `/`.
2. App inserts a `lessons` row with `status = "generating"` and navigates to `/lesson/$lessonId`.
3. Backend calls the AI provider with the lesson tool schema, validates with Pydantic, writes `lesson_sections`.
4. Lesson view polls until `status = "ready"`, then begins playback.

## Functional requirements

- 4–6 sections per lesson.
- Each section has: `heading`, `script` (spoken text), `whiteboard` (timed event array), `sources` (optional URLs), `estimated_duration_s`.
- Whiteboard events have absolute `at` seconds within their section, sorted ascending.
- Lesson `status` lifecycle: `generating → ready | failed` with an `error` message on failure.

## Quality bar

Tracked in `backend/evals/lesson_core_flow.py`:
- Schema validity
- 4–6 section compliance
- Spoken script length sanity
- Whiteboard timeline ordering
- Topic term coverage
- Source URL shape
- Aggregate score gate via `EVAL_FAIL_UNDER`.

## Dependencies

- OpenAI-compatible chat completions provider (`AI_API_KEY`, `AI_MODEL`).
- Supabase tables `lessons`, `lesson_sections` with RLS scoped to `user_id`.

## Open questions

- Should we let users pick depth (overview vs deep dive) up front?
- Should section count flex with topic complexity?
