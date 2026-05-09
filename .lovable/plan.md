## Goal

After a lesson is generated, persist both the **tutor audio** (from ElevenLabs) and the **whiteboard event timeline** so the lesson can be replayed deterministically — with full scrubbing, pause/resume, and per-section seek.

Today the whiteboard timeline is already saved per section (`lesson_sections.whiteboard` jsonb with `at` timestamps), but:
- Audio is generated live via the browser's `speechSynthesis` and is not stored.
- The timeline clock is local-only and not synced to an audio element.
- There are no scrub/seek controls — only Pause/Resume.

This plan wires audio storage + an audio-driven timeline + a transport bar.

---

## 1. Storage: audio files

Create a private Supabase Storage bucket `lesson-audio`.

```text
lesson-audio/
  {lessonId}/
    {sectionId}.mp3
```

RLS: a user can read/write objects only when the `{lessonId}` folder belongs to a lesson they own (checked via `lessons.user_id = auth.uid()`).

Add columns to `lesson_sections`:
- `audio_path text` — storage object path (e.g. `abc/def.mp3`)
- `audio_duration_ms integer` — exact duration for the scrubber
- `audio_voice_id text` — which ElevenLabs voice was used (for cache invalidation)

## 2. Generation pipeline (server function)

New server function `synthesizeSectionAudio` in `src/lib/lesson-audio.functions.ts`:

1. Loads the section's `script`.
2. Calls ElevenLabs TTS REST API (`/v1/text-to-speech/{voice_id}`) with the `ELEVENLABS_API_KEY` secret — returns mp3 bytes.
3. Uploads bytes to `lesson-audio/{lessonId}/{sectionId}.mp3` via `supabaseAdmin.storage`.
4. Probes duration (decode header / use returned `Content-Length` + bitrate, or use `music-metadata` lite parser).
5. Updates `lesson_sections` with `audio_path` and `audio_duration_ms`.

Hook this into `generate-lesson.ts` after the lesson sections are inserted: kick off audio synthesis in parallel for all sections, mark `lessons.status = 'ready'` only when text is ready (audio can stream in progressively — sections without audio fall back to browser TTS).

## 3. Timeline rewrite: drive from audio

Replace `useSectionTimeline` with `useAudioTimeline(audioUrl, fallbackDuration)`:
- Owns a single `<audio>` element ref.
- Exposes `{ elapsed, duration, playing, play, pause, seek(s), playbackRate, setRate }`.
- `elapsed` updates from the audio element's `timeupdate` (plus a rAF tick for smooth scrubbing).
- When `audioUrl` is null (still synthesizing or failed), falls back to the current browser-TTS clock.

The whiteboard's existing `events.filter(e => e.at <= elapsed)` logic stays — it already supports arbitrary seek because `at` is absolute seconds within the section.

## 4. Transport / scrub bar (UI)

New `TransportBar` component, mounted under the whiteboard:

```text
[ ⏮ ][ ▶/⏸ ][ ⏭ ]   ━━━━●─────────────  02:14 / 04:38   [1x ▾]
```

- Uses shadcn `Slider` for the scrub track (already in project).
- Click/drag the slider → `timeline.seek(value)` → audio jumps → whiteboard re-derives visible events instantly.
- Prev/Next jump between sections.
- Speed menu: 0.75x / 1x / 1.25x / 1.5x / 2x — sets `audio.playbackRate`.
- Keyboard: Space = play/pause, ←/→ = ±5s, J/L = ±10s.

## 5. Lesson view integration

In `src/routes/lesson.$lessonId.tsx`:
- Build a signed URL for `activeSection.audio_path` on section change (1h expiry).
- Pass it to `useAudioTimeline`.
- Remove the `useTutorSpeech.speak(script)` call when audio exists; keep `useTutorSpeech` only as fallback.
- Drive `TutorOrb`'s amplitude from the audio element via Web Audio `AnalyserNode` instead of speech-synthesis events.
- When user asks a Q&A question, still use browser TTS for the answer (separate, ephemeral).

## 6. Caching & re-gen

- If `audio_path` already exists for a section, skip synthesis (idempotent).
- Add a "Regenerate audio" action (later, not in this pass) for voice changes.

---

## Technical notes

- **Secret needed:** `ELEVENLABS_API_KEY` (will request via `add_secret` when you're ready). Voice ID can live in code as a constant initially.
- **Duration probing:** ElevenLabs returns `mp3_44100_128` by default — duration ≈ `bytes * 8 / 128000`. Good enough for scrubber bounds; refined client-side once `<audio>` reports `loadedmetadata`.
- **Streaming option (future):** ElevenLabs also has a streaming endpoint we could pipe directly to the client and store async — out of scope for this pass.
- **Bucket created via migration** with RLS using a `has_lesson_access(lesson_id)` SECURITY DEFINER helper to keep storage policies readable.

---

## Out of scope (call out for later)

- Word-level highlighting on the whiteboard (would need ElevenLabs alignment API).
- Background pre-fetching audio for the next section.
- Offline caching of audio in IndexedDB.

Approve this and I'll implement it in the order above (migration → server function → timeline hook → transport UI → lesson view wiring). I'll request `ELEVENLABS_API_KEY` right before the server function step.