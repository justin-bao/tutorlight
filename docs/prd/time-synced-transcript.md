# PRD — Time-Synced Transcript

## Problem

Audio is great for ingestion, but bad for review. Learners want to *see* the words go by, jump to a phrase they half-remember, and bookmark sections — without leaving the lesson.

## Users & jobs

- **Skimmers:** Want to read ahead while the tutor catches up.
- **Reviewers:** Want to find a phrase from earlier ("where did she mention impedance?").
- **Note-takers:** Want to click a word to jump back and re-listen.
- **Accessibility:** Hard-of-hearing users rely on captions.

## Goals

- Render a scrollable transcript with the active word highlighted in real time.
- Let users click any word to seek the audio there.
- Let users search the transcript and jump to the closest match to current time.
- Provide a per-section table of contents derived from sentence boundaries.

## Non-goals

- Editing the transcript.
- Translating to other languages.
- Cross-section transcript view.

## Experience

- Transcript appears under the whiteboard/transport bar.
- Active word: subtle background highlight; auto-scrolls to center.
- Search box at the top: typing filters/locates matches; arrow buttons step through them; counter shows `n/total`.
- Bookmark row above the transcript: up to ~6 evenly-distributed sentence anchors with `mm:ss` labels — click to seek.
- Falls back to plain script text when alignment data isn't available yet.

## Functional requirements

- ElevenLabs `with-timestamps` endpoint provides character-level alignment; we collapse to word-level and store as `lesson_sections.audio_alignment` (jsonb).
- `Transcript.tsx` props: `words`, `fallbackText`, `elapsed`, `onSeek`.
- Active-word lookup uses binary search on word `start` times.
- Search splits the query on whitespace and matches across word boundaries.
- Bookmarks: split transcript on `[.!?]$`, sample up to 6 evenly across the section.

## Quality bar

- Active-word highlight stays within ±1 word of audio at 1.0x and 2.0x speed.
- Search match navigation feels instant (<100ms perceived).
- Long transcripts remain smooth (no layout thrash on each tick).

## Dependencies

- ElevenLabs `with-timestamps` TTS response.
- `lesson_sections.audio_alignment` column.
- `useAudioTimeline.elapsed` and `seek`.

## Open questions

- Multi-section "find in lesson" search?
- Allow users to save custom bookmarks?
- Export transcript as markdown / SRT?
