import { createServerFn, useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Default ElevenLabs voice (Sarah). Easy to swap later or make user-configurable.
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const MODEL_ID = "eleven_turbo_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128"; // bitrate 128kbps used for duration estimation

/**
 * Synthesize the audio for a single lesson section using ElevenLabs and store
 * the resulting mp3 in the `lesson-audio` bucket. Idempotent: returns the
 * existing audio_path if one is already saved for the section.
 */
export const synthesizeSectionAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ sectionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load section + parent lesson, enforcing ownership via RLS-aware client.
    const { data: section, error: secErr } = await supabase
      .from("lesson_sections")
      .select("id, lesson_id, script, audio_path, audio_duration_ms")
      .eq("id", data.sectionId)
      .maybeSingle();

    if (secErr) throw new Error(secErr.message);
    if (!section) throw new Error("Section not found");

    // Cached?
    if (section.audio_path) {
      return {
        audio_path: section.audio_path,
        audio_duration_ms: section.audio_duration_ms ?? null,
        cached: true,
      };
    }

    // Helper: build word-level alignment from ElevenLabs character alignment.
    function wordsFromAlignment(a: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    }) {
      const words: { text: string; start: number; end: number }[] = [];
      let cur = "";
      let curStart = 0;
      for (let i = 0; i < a.characters.length; i++) {
        const ch = a.characters[i];
        const isSpace = /\s/.test(ch);
        if (!isSpace) {
          if (cur === "") curStart = a.character_start_times_seconds[i] ?? 0;
          cur += ch;
        }
        if (isSpace || i === a.characters.length - 1) {
          if (cur !== "") {
            const endIdx = isSpace ? i - 1 : i;
            words.push({
              text: cur,
              start: curStart,
              end: a.character_end_times_seconds[endIdx] ?? curStart,
            });
            cur = "";
          }
        }
      }
      return words;
    }

    // Verify the parent lesson belongs to this user (defensive — RLS already enforces).
    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, user_id")
      .eq("id", section.lesson_id)
      .maybeSingle();
    if (!lesson || lesson.user_id !== userId) throw new Error("Forbidden");

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

    // Trim text to a safe length per request.
    const text = (section.script ?? "").slice(0, 4800);
    if (!text.trim()) throw new Error("Section has no script to synthesize");

    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}/with-timestamps?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      throw new Error(`ElevenLabs TTS failed (${ttsResp.status}): ${errText.slice(0, 200)}`);
    }

    const payload = (await ttsResp.json()) as {
      audio_base64: string;
      alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      } | null;
      normalized_alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      } | null;
    };

    const audioBuf = Uint8Array.from(atob(payload.audio_base64), (c) => c.charCodeAt(0));

    const align = payload.normalized_alignment ?? payload.alignment ?? null;
    const words = align ? wordsFromAlignment(align) : [];
    const lastWord = words[words.length - 1];
    const alignedDurationMs = lastWord ? Math.round(lastWord.end * 1000) : null;

    // Estimate duration from bitrate as a fallback.
    const estimatedDurationMs =
      alignedDurationMs ?? Math.round((audioBuf.byteLength * 8) / 128);

    const objectPath = `${section.lesson_id}/${section.id}.mp3`;

    // Upload via admin client (bypasses RLS — we've already verified ownership).
    const { error: upErr } = await supabaseAdmin.storage
      .from("lesson-audio")
      .upload(objectPath, audioBuf, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { error: updErr } = await supabaseAdmin
      .from("lesson_sections")
      .update({
        audio_path: objectPath,
        audio_duration_ms: estimatedDurationMs,
        audio_voice_id: DEFAULT_VOICE_ID,
        audio_alignment: words.length > 0 ? { words } : null,
      })
      .eq("id", section.id);
    if (updErr) throw new Error(`Update failed: ${updErr.message}`);

    return {
      audio_path: objectPath,
      audio_duration_ms: estimatedDurationMs,
      cached: false,
    };
  });

/**
 * Returns a short-lived signed URL for a section's stored audio.
 * Returns null if no audio_path is set yet.
 */
export const getSectionAudioUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ sectionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: section, error } = await supabase
      .from("lesson_sections")
      .select("audio_path, audio_duration_ms, audio_alignment")
      .eq("id", data.sectionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!section?.audio_path) {
      return {
        url: null,
        audio_duration_ms: null as number | null,
        alignment: null as { words: { text: string; start: number; end: number }[] } | null,
      };
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("lesson-audio")
      .createSignedUrl(section.audio_path, 60 * 60); // 1 hour
    if (signErr || !signed) throw new Error(signErr?.message ?? "Failed to sign URL");

    return {
      url: signed.signedUrl,
      audio_duration_ms: section.audio_duration_ms,
      alignment: (section.audio_alignment ?? null) as
        | { words: { text: string; start: number; end: number }[] }
        | null,
    };
  });

// Re-export hook for convenience
export { useServerFn };
