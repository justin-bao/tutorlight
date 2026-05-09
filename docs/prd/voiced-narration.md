# PRD — Voiced Narration & Audio Timeline

## Problem

A silent whiteboard is just slides. A tutor's *voice* is what makes a lesson feel like teaching, not reading. And once there's audio, the audio must be the **single clock** that drives the whiteboard, transcript, and any future visualizations — otherwise things drift.

## Users & jobs

- **Auditory learners:** Want to listen, optionally with the screen off-glance.
- **Multitaskers:** Walking, commuting, doing chores while learning.
- **Anyone replaying a lesson:** Wants to scrub back to "the bit about X" and have the whole experience snap to that moment.

## Goals

- Synthesize high-quality narration per section using ElevenLabs.
- Persist audio so replays are deterministic and free.
- Make the audio element the source of truth for the playback clock.
- Provide standard transport controls: play/pause, prev/next section, scrub, speed.

## Non-goals (this pass)

- Voice selection per user.
- Streaming TTS (we synthesize-then-store).
- Background pre-fetching of next section.
- Offline IndexedDB caching.

## Experience

- First time a section is viewed, audio synthesizes in the background; UI uses a fallback (browser SpeechSynthesis + wall clock) so playback isn't blocked.
- On replay, audio loads from Supabase Storage via signed URL — instant.
- Transport bar under the whiteboard shows: `⏮ ▶/⏸ ⏭` · scrubber · `mm:ss / mm:ss` · speed menu.
- Keyboard: Space = play/pause, ←/→ = ±5s.

## Functional requirements

- Private `lesson-audio` Supabase Storage bucket; objects keyed `{lessonId}/{sectionId}.mp3`.
- RLS via `has_lesson_access(lesson_id)` SECURITY DEFINER helper.
- `lesson_sections.audio_path`, `audio_duration_ms`, `audio_voice_id` columns.
- `useAudioTimeline(audioUrl, fallbackDuration)` hook owns the `<audio>` element and exposes `{ elapsed, duration, playing, play, pause, seek, playbackRate, setRate }`.
- Whiteboard derives visible elements from `useAudioTimeline.elapsed`.
- Idempotent synthesis: skip if `audio_path` exists.

## Quality bar

- Scrubbing the slider instantly updates whiteboard state (no perceptible lag).
- Speed change preserves audio pitch (browser default `preservesPitch`).
- Audio synthesis failure falls back gracefully without breaking the lesson.

## Dependencies

- `ELEVENLABS_API_KEY` secret.
- Supabase Storage + RLS helper function.

## Open questions

- Per-user voice preferences?
- Pre-fetch next section's audio while current one plays?
