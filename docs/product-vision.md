# Tutorlight — Product Vision

## One-line thesis

Tutorlight turns any topic into a guided, voiced lesson with a live whiteboard and a tutor you can interrupt — so curious learners can actually *understand* something new in 5–10 minutes, not just skim a wiki page.

## Who it's for

- **Self-directed learners** who Google a concept and bounce between Wikipedia, YouTube, and Reddit trying to assemble a coherent picture.
- **Students** who want a patient, on-demand explainer for a homework concept without booking a tutor.
- **Curious professionals** who need a fast, high-trust primer on an unfamiliar topic adjacent to their work (a PM learning embeddings, a designer learning DNS).
- **Lifelong learners** who prefer being *taught* over being handed a wall of text.

## What it solves

| Problem today | Tutorlight's answer |
|---|---|
| Reading static articles is passive and easy to zone out on | A spoken tutor + animated whiteboard keeps both ears and eyes engaged |
| Videos can't adapt to your specific question | Contextual Q&A grounded in the current section + selected whiteboard items |
| You can't easily jump back to "the bit about X" | Time-synced transcript, scrubbing, and a table of contents per section |
| AI chat answers feel ungrounded and one-shot | Lessons are structured (4–6 sections, sources, definitions, equations) and persist in your library |
| Each tool gives you one modality — text *or* audio *or* diagrams | The whiteboard, narration, and transcript are all driven off the same timeline |

## Core experience

1. Type a topic.
2. Tutorlight generates a structured lesson (sections, script, whiteboard events, sources).
3. ElevenLabs voices the tutor; the whiteboard animates in sync.
4. You can pause, scrub, change speed, search the transcript, or click a bookmark.
5. Select anything on the whiteboard and ask a follow-up — answers cite what's on screen.
6. Every lesson is saved to your library and replayable deterministically.

## Design principles

- **Teach, don't dump.** Every output is paced and narrated, not a wall of markdown.
- **Grounded over generative.** Lessons cite sources; Q&A references the visible board.
- **The timeline is the source of truth.** Audio, whiteboard, and transcript share one clock — scrubbing one scrubs all.
- **Own your library.** Lessons persist per user with strict RLS; nothing is shared by default.
- **Fallbacks beat blank screens.** If TTS fails, browser SpeechSynthesis takes over; if audio is still rendering, the wall-clock timeline runs.

## Non-goals (today)

- Multi-user / classroom mode.
- Long-form courses or certifications.
- Mobile-native apps.
- Real-time collaborative whiteboarding.

## Feature index

Each feature has its own PRD in `docs/prd/`:

- [Lesson Generation](./prd/lesson-generation.md)
- [Dynamic Whiteboard](./prd/dynamic-whiteboard.md)
- [Voiced Narration & Audio Timeline](./prd/voiced-narration.md)
- [Time-Synced Transcript](./prd/time-synced-transcript.md)
- [Contextual Q&A](./prd/contextual-qa.md)
- [Lesson Library & Auth](./prd/lesson-library-auth.md)
