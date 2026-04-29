import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Whiteboard event schema (mirrors src/lib/whiteboard-types.ts)
const WhiteboardEvent = z.discriminatedUnion("type", [
  z.object({ id: z.string(), at: z.number(), type: z.literal("title"), text: z.string() }),
  z.object({ id: z.string(), at: z.number(), type: z.literal("bullet"), text: z.string(), under: z.string().optional() }),
  z.object({ id: z.string(), at: z.number(), type: z.literal("definition"), term: z.string(), definition: z.string() }),
  z.object({ id: z.string(), at: z.number(), type: z.literal("equation"), latex: z.string(), caption: z.string().optional() }),
  z.object({
    id: z.string(),
    at: z.number(),
    type: z.literal("diagram"),
    shape: z.enum(["flow", "cycle", "tree", "compare", "axis"]),
    nodes: z.array(z.object({ id: z.string(), label: z.string(), sub: z.string().optional() })),
    edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })).optional(),
    caption: z.string().optional(),
  }),
  z.object({ id: z.string(), at: z.number(), type: z.literal("image"), image_prompt: z.string(), caption: z.string().optional() }),
  z.object({ id: z.string(), at: z.number(), type: z.literal("code"), language: z.string(), code: z.string(), caption: z.string().optional() }),
  z.object({ id: z.string(), at: z.number(), type: z.literal("annotation"), targetId: z.string(), text: z.string() }),
  z.object({ id: z.string(), at: z.number(), type: z.literal("clear") }),
]);

const LessonSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        script: z.string(),
        estimated_duration_s: z.number().int().min(20).max(240),
        whiteboard: z.array(WhiteboardEvent).max(20),
        sources: z.array(z.object({ title: z.string(), url: z.string() })).max(6).default([]),
      })
    )
    .min(3)
    .max(7),
});

const InputSchema = z.object({
  lessonId: z.string().uuid(),
  topic: z.string().min(2).max(500),
});

const SYSTEM_PROMPT = `You are an expert curriculum designer who creates short, engaging audio lessons taught by an AI tutor on a virtual whiteboard.

Given a topic, produce a structured lesson with 4–6 sections. For EACH section:

1. Write a "script" the tutor will speak aloud — natural, conversational, ~80–160 words. No markdown, no headings, no bullet syntax.

2. Estimate "estimated_duration_s" — roughly (words / 2.5) seconds. Keep it between 30 and 120.

3. Build a "whiteboard" timeline: ordered events the tutor "writes on the board" while speaking, each with an "at" time in seconds (0..estimated_duration_s). Distribute events across the section. Every key idea should map to a board event.

   Event types and when to use them:
   - "title": one big heading per section, at: 0
   - "bullet": short labeled point (under?: a previous bullet/title id to nest)
   - "definition": term + concise definition for any new vocabulary
   - "equation": LaTeX (no $ delimiters) for any math
   - "diagram": a structural visual. shape is one of:
       * "flow" — left-to-right process (use edges for arrows)
       * "cycle" — circular loop of nodes
       * "tree" — hierarchy from one root (use edges parent->child)
       * "compare" — two columns of nodes labeled A vs B
       * "axis" — labeled axes; nodes are points to plot (use sub for coords like "x=2,y=3")
     ALWAYS include 3–7 nodes and (for flow/tree) edges. Keep labels under 28 chars.
   - "image": only when a real-world reference photo would help; give a vivid image_prompt
   - "code": only for programming topics
   - "annotation": draw attention to an earlier element by id, with a short note
   - "clear": rarely used; only between major sub-topics within a long section

   Each event MUST have a unique stable id (e.g. "s1-e1").

4. "sources": 0–4 reputable external links (Wikipedia, official docs, well-known orgs). Use real URLs you are confident exist. Skip if unsure.

Pacing rules:
- Section 1 should orient the learner (what we'll cover, why it matters).
- Final section should summarise and suggest 1–2 next steps.
- Vary whiteboard event types — don't make every section just bullets.
- Use diagrams when concepts are structural, equations when math is involved.

Output ONLY by calling the build_lesson tool.`;

export const Route = createFileRoute("/api/generate-lesson")({
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
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return Response.json({ error: "Backend not configured" }, { status: 500 });
        }
        if (!LOVABLE_API_KEY) {
          return Response.json({ error: "AI not configured" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: z.infer<typeof InputSchema>;
        try {
          body = InputSchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }

        // Verify lesson belongs to this user
        const { data: lesson, error: lessonErr } = await supabase
          .from("lessons")
          .select("id,status")
          .eq("id", body.lessonId)
          .single();
        if (lessonErr || !lesson) {
          return Response.json({ error: "Lesson not found" }, { status: 404 });
        }

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
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Topic: ${body.topic}` },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "build_lesson",
                    description: "Return a complete lesson with whiteboard timeline.",
                    parameters: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        summary: { type: "string" },
                        sections: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              heading: { type: "string" },
                              script: { type: "string" },
                              estimated_duration_s: { type: "number" },
                              whiteboard: { type: "array", items: { type: "object" } },
                              sources: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    title: { type: "string" },
                                    url: { type: "string" },
                                  },
                                  required: ["title", "url"],
                                },
                              },
                            },
                            required: ["heading", "script", "estimated_duration_s", "whiteboard", "sources"],
                          },
                        },
                      },
                      required: ["title", "summary", "sections"],
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "build_lesson" } },
            }),
          });

          if (!aiResp.ok) {
            const text = await aiResp.text();
            await supabase
              .from("lessons")
              .update({ status: "failed", error: `AI ${aiResp.status}: ${text.slice(0, 300)}` })
              .eq("id", body.lessonId);
            return Response.json(
              { error: aiResp.status === 429 ? "Rate limited" : aiResp.status === 402 ? "Out of AI credits" : "AI error" },
              { status: aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500 }
            );
          }

          const aiJson = await aiResp.json();
          const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall?.function?.arguments) {
            throw new Error("AI did not return a lesson");
          }
          const parsedArgs = JSON.parse(toolCall.function.arguments);
          const lessonData = LessonSchema.parse(parsedArgs);

          // Persist
          await supabase
            .from("lessons")
            .update({
              title: lessonData.title,
              summary: lessonData.summary,
              status: "ready",
              error: null,
            })
            .eq("id", body.lessonId);

          const sectionsToInsert = lessonData.sections.map((s, i) => ({
            lesson_id: body.lessonId,
            order_index: i,
            heading: s.heading,
            script: s.script,
            estimated_duration_s: s.estimated_duration_s,
            whiteboard: s.whiteboard,
            sources: s.sources ?? [],
          }));
          const { error: secErr } = await supabase.from("lesson_sections").insert(sectionsToInsert);
          if (secErr) throw secErr;

          return Response.json({ ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown";
          await supabase
            .from("lessons")
            .update({ status: "failed", error: msg.slice(0, 500) })
            .eq("id", body.lessonId);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
