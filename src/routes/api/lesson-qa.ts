import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const InputSchema = z.object({
  lessonId: z.string().uuid(),
  sectionId: z.string().uuid(),
  question: z.string().min(1).max(800),
  pinnedElement: z
    .object({
      id: z.string(),
      type: z.string(),
      summary: z.string(),
    })
    .nullable()
    .optional(),
});

export const Route = createFileRoute("/api/lesson-qa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const token = authHeader.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !LOVABLE_API_KEY) {
          return Response.json({ error: "Backend not configured" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        let body: z.infer<typeof InputSchema>;
        try {
          body = InputSchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }

        // Pull lesson + current section context
        const { data: lesson } = await supabase
          .from("lessons")
          .select("title, summary")
          .eq("id", body.lessonId)
          .single();
        const { data: section } = await supabase
          .from("lesson_sections")
          .select("heading, script")
          .eq("id", body.sectionId)
          .single();
        if (!lesson || !section) return Response.json({ error: "Not found" }, { status: 404 });

        // Persist user message
        await supabase.from("lesson_messages").insert({
          lesson_id: body.lessonId,
          section_id: body.sectionId,
          role: "user",
          content: body.question,
          pinned_element_id: body.pinnedElement?.id ?? null,
        });

        const systemPrompt = `You are the AI tutor mid-lesson. Answer the learner's question briefly and conversationally (2–4 sentences). Stay grounded in the current lesson context. Speak as if continuing the live lesson — no preamble like "Great question".

Lesson: ${lesson.title}
Summary: ${lesson.summary}
Current section: ${section.heading}
Section script you just delivered: ${section.script}${
          body.pinnedElement
            ? `\n\nThe learner pointed at this element on the whiteboard: ${body.pinnedElement.type} — ${body.pinnedElement.summary}`
            : ""
        }`;

        try {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: body.question },
              ],
            }),
          });
          if (!aiResp.ok) {
            return Response.json(
              { error: aiResp.status === 429 ? "Rate limited" : aiResp.status === 402 ? "Out of AI credits" : "AI error" },
              { status: aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500 }
            );
          }
          const aiJson = await aiResp.json();
          const answer: string = aiJson.choices?.[0]?.message?.content ?? "Sorry, I couldn't answer that.";

          await supabase.from("lesson_messages").insert({
            lesson_id: body.lessonId,
            section_id: body.sectionId,
            role: "assistant",
            content: answer,
          });

          return Response.json({ answer });
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
        }
      },
    },
  },
});
