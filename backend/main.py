import json
import os
from typing import Any, Literal
from uuid import UUID

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4.1-mini")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

app = FastAPI(title="Tutorlight API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in FRONTEND_ORIGIN.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class WhiteboardNode(BaseModel):
    id: str
    label: str
    sub: str | None = None


class WhiteboardEdge(BaseModel):
    from_: str = Field(alias="from")
    to: str
    label: str | None = None


class WhiteboardEvent(BaseModel):
    id: str
    at: float
    type: Literal["title", "bullet", "definition", "equation", "diagram", "image", "code", "annotation", "clear"]
    text: str | None = None
    under: str | None = None
    term: str | None = None
    definition: str | None = None
    latex: str | None = None
    caption: str | None = None
    shape: Literal["flow", "cycle", "tree", "compare", "axis"] | None = None
    nodes: list[WhiteboardNode] | None = None
    edges: list[WhiteboardEdge] | None = None
    image_prompt: str | None = None
    language: str | None = None
    code: str | None = None
    targetId: str | None = None


class Source(BaseModel):
    title: str
    url: str


class LessonSection(BaseModel):
    heading: str
    script: str
    estimated_duration_s: int = Field(ge=20, le=240)
    whiteboard: list[WhiteboardEvent] = Field(max_length=20)
    sources: list[Source] = Field(default_factory=list, max_length=6)


class LessonPayload(BaseModel):
    title: str
    summary: str
    sections: list[LessonSection] = Field(min_length=3, max_length=7)


class GenerateLessonInput(BaseModel):
    lessonId: UUID
    topic: str = Field(min_length=2, max_length=500)


class BoardRef(BaseModel):
    id: str
    type: str
    summary: str


class LessonSuggestionsInput(BaseModel):
    lessonId: UUID


class LessonQaInput(BaseModel):
    lessonId: UUID
    sectionId: UUID
    question: str = Field(min_length=1, max_length=800)
    pinnedElements: list[BoardRef] = Field(default_factory=list)
    whiteboardSnapshot: list[BoardRef] = Field(default_factory=list)
    availableSources: list[Source] = Field(default_factory=list, max_length=12)
    elapsedSeconds: float | None = None
    spokenSoFar: str | None = Field(default=None, max_length=8000)
    recentEmphasis: str | None = Field(default=None, max_length=2000)


QA_TOOL_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "respond_with_citations",
        "description": "Answer the learner's follow-up question, citing whiteboard items and sources that informed the answer.",
        "parameters": {
            "type": "object",
            "properties": {
                "answer": {"type": "string", "description": "2-4 sentence conversational answer."},
                "citedBoardIds": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Whiteboard item ids (from the snapshot) you actually relied on. Empty if none.",
                },
                "citedSourceUrls": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Source URLs (from the available sources list) you actually relied on. Empty if none.",
                },
            },
            "required": ["answer", "citedBoardIds", "citedSourceUrls"],
        },
    },
}


VALID_TYPES = {"title", "bullet", "definition", "equation", "diagram", "image", "code", "annotation", "clear"}
VALID_SHAPES = {"flow", "cycle", "tree", "compare", "axis"}

LESSON_TOOL_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "build_lesson",
        "description": "Return a complete lesson with whiteboard timeline.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "summary": {"type": "string"},
                "sections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "heading": {"type": "string"},
                            "script": {"type": "string"},
                            "estimated_duration_s": {"type": "number"},
                            "whiteboard": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "string"},
                                        "at": {"type": "number"},
                                        "type": {
                                            "type": "string",
                                            "enum": list(VALID_TYPES),
                                        },
                                        "text": {"type": "string"},
                                        "under": {"type": "string"},
                                        "term": {"type": "string"},
                                        "definition": {"type": "string"},
                                        "latex": {"type": "string"},
                                        "caption": {"type": "string"},
                                        "shape": {"type": "string", "enum": list(VALID_SHAPES)},
                                        "nodes": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "id": {"type": "string"},
                                                    "label": {"type": "string"},
                                                    "sub": {"type": "string"},
                                                },
                                                "required": ["id", "label"],
                                            },
                                        },
                                        "edges": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "from": {"type": "string"},
                                                    "to": {"type": "string"},
                                                    "label": {"type": "string"},
                                                },
                                                "required": ["from", "to"],
                                            },
                                        },
                                        "image_prompt": {"type": "string"},
                                        "language": {"type": "string"},
                                        "code": {"type": "string"},
                                        "targetId": {"type": "string"},
                                    },
                                    "required": ["id", "at", "type"],
                                },
                            },
                            "sources": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string"},
                                        "url": {"type": "string"},
                                    },
                                    "required": ["title", "url"],
                                },
                            },
                        },
                        "required": ["heading", "script", "estimated_duration_s", "whiteboard", "sources"],
                    },
                },
            },
            "required": ["title", "summary", "sections"],
        },
    },
}

SYSTEM_PROMPT = """You are an expert curriculum designer who creates short, engaging audio lessons taught by an AI tutor on a virtual whiteboard.

Given a topic, produce a structured lesson with 4-6 sections. For EACH section:

1. Write a "script" the tutor will speak aloud. Make it natural, conversational, 80-160 words, with no markdown headings or bullet syntax.
2. Estimate "estimated_duration_s" as roughly words / 2.5 seconds. Keep it between 30 and 120.
3. Build a "whiteboard" timeline of ordered events the tutor writes on the board while speaking. Each event has an "at" time in seconds. Distribute events across the section.
4. Include 0-4 reputable sources per section. Use real URLs you are confident exist.

Whiteboard event types:
- title: one big heading per section, at 0
- bullet: short labeled point
- definition: term plus concise definition
- equation: LaTeX without dollar delimiters
- diagram: shape is flow, cycle, tree, compare, or axis; include 3-7 nodes and flow/tree edges
- image: only when a real-world reference photo would help
- code: only for programming topics
- annotation: draw attention to an earlier element
- clear: rarely, only between major sub-topics

Every event must have a unique stable id like "s1-e1".
Section 1 should orient the learner. The final section should summarize and suggest 1-2 next steps.
Output only by calling the build_lesson tool."""


def configured() -> None:
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase is not configured")
    if not AI_API_KEY:
        raise HTTPException(status_code=500, detail="AI is not configured")


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return authorization.removeprefix("Bearer ").strip()


def supabase_headers(token: str) -> dict[str, str]:
    return {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def supabase_request(
    client: httpx.AsyncClient,
    token: str,
    method: str,
    path: str,
    *,
    params: dict[str, str] | None = None,
    json_body: Any = None,
    extra_headers: dict[str, str] | None = None,
) -> Any:
    headers = supabase_headers(token)
    if extra_headers:
        headers.update(extra_headers)
    response = await client.request(
        method,
        f"{SUPABASE_URL}{path}",
        params=params,
        json=json_body,
        headers=headers,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    if not response.content:
        return None
    return response.json()


async def ensure_user(client: httpx.AsyncClient, token: str) -> dict[str, Any]:
    response = await client.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers=supabase_headers(token),
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return response.json()


def first_string(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def infer_whiteboard_type(event: dict[str, Any]) -> str | None:
    if event.get("type") in VALID_TYPES:
        return event["type"]
    if first_string(event.get("term"), event.get("definition"), event.get("description"), event.get("meaning")):
        return "definition"
    if isinstance(event.get("nodes"), list) or first_string(event.get("shape")):
        return "diagram"
    if first_string(event.get("latex"), event.get("formula"), event.get("equation")):
        return "equation"
    if first_string(event.get("image_prompt"), event.get("prompt"), event.get("imagePrompt")):
        return "image"
    if first_string(event.get("code"), event.get("snippet")):
        return "code"
    if first_string(event.get("targetId"), event.get("target_id")):
        return "annotation"
    if first_string(event.get("text"), event.get("label"), event.get("caption"), event.get("title")):
        return "bullet"
    return None


def normalize_event(event: Any, section_index: int, event_index: int) -> dict[str, Any] | None:
    if not isinstance(event, dict):
        return None
    event_type = infer_whiteboard_type(event)
    if not event_type:
        return None
    base = {
        "id": first_string(event.get("id")) or f"s{section_index + 1}-e{event_index + 1}",
        "at": event.get("at") if isinstance(event.get("at"), (int, float)) else event_index * 8,
        "type": event_type,
    }
    if event_type == "title":
        text = first_string(event.get("text"), event.get("title"), event.get("label"), event.get("caption"))
        return {**base, "text": text} if text else None
    if event_type == "bullet":
        text = first_string(event.get("text"), event.get("label"), event.get("caption"), event.get("title"), event.get("summary"))
        return {**base, "text": text, "under": first_string(event.get("under"), event.get("parentId"))} if text else None
    if event_type == "definition":
        definition = first_string(
            event.get("definition"),
            event.get("description"),
            event.get("meaning"),
            event.get("body"),
            event.get("explanation"),
            event.get("text"),
            event.get("caption"),
        )
        if not definition:
            return None
        return {**base, "term": first_string(event.get("term"), event.get("title"), event.get("label"), event.get("text")) or "Key idea", "definition": definition}
    if event_type == "equation":
        latex = first_string(event.get("latex"), event.get("formula"), event.get("equation"), event.get("text"))
        return {**base, "latex": latex, "caption": first_string(event.get("caption"))} if latex else None
    if event_type == "diagram":
        nodes = []
        for node_index, node in enumerate(event.get("nodes") if isinstance(event.get("nodes"), list) else []):
            if not isinstance(node, dict):
                continue
            nodes.append({
                "id": first_string(node.get("id")) or f"n{node_index + 1}",
                "label": first_string(node.get("label"), node.get("text"), node.get("title"), node.get("name")) or f"Step {node_index + 1}",
                "sub": first_string(node.get("sub"), node.get("caption"), node.get("description")),
            })
        if not nodes:
            return None
        edges = []
        for edge in event.get("edges") if isinstance(event.get("edges"), list) else []:
            if not isinstance(edge, dict):
                continue
            edge_from = first_string(edge.get("from"), edge.get("source"))
            edge_to = first_string(edge.get("to"), edge.get("target"))
            if edge_from and edge_to:
                edges.append({"from": edge_from, "to": edge_to, "label": first_string(edge.get("label"))})
        return {
            **base,
            "shape": event.get("shape") if event.get("shape") in VALID_SHAPES else "flow",
            "nodes": nodes,
            "edges": edges or None,
            "caption": first_string(event.get("caption")),
        }
    if event_type == "image":
        prompt = first_string(event.get("image_prompt"), event.get("prompt"), event.get("imagePrompt"), event.get("caption"), event.get("text"))
        return {**base, "image_prompt": prompt, "caption": first_string(event.get("caption"))} if prompt else None
    if event_type == "code":
        code = first_string(event.get("code"), event.get("snippet"), event.get("text"))
        return {**base, "language": first_string(event.get("language"), event.get("lang")) or "text", "code": code, "caption": first_string(event.get("caption"))} if code else None
    if event_type == "annotation":
        return {
            **base,
            "targetId": first_string(event.get("targetId"), event.get("target_id"), event.get("target")) or "",
            "text": first_string(event.get("text"), event.get("label"), event.get("caption")) or "Notice this",
        }
    return base


def normalize_lesson(args: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(args.get("sections"), list):
        return args
    normalized_sections = []
    for section_index, section in enumerate(args["sections"]):
        if not isinstance(section, dict):
            continue
        events = [
            normalized
            for event_index, event in enumerate(section.get("whiteboard") if isinstance(section.get("whiteboard"), list) else [])
            if (normalized := normalize_event(event, section_index, event_index))
        ]
        normalized_sections.append({**section, "whiteboard": events, "sources": section.get("sources") if isinstance(section.get("sources"), list) else []})
    return {**args, "sections": normalized_sections}


async def ai_chat(payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            f"{AI_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
    if response.status_code >= 400:
        detail = "Rate limited" if response.status_code == 429 else response.text
        raise HTTPException(status_code=response.status_code if response.status_code in {402, 429} else 500, detail=detail)
    return response.json()


def lesson_generation_payload(topic: str) -> dict[str, Any]:
    return {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Topic: {topic}"},
        ],
        "tools": [LESSON_TOOL_SCHEMA],
        "tool_choice": {"type": "function", "function": {"name": "build_lesson"}},
    }


def parse_lesson_generation(ai_json: dict[str, Any]) -> LessonPayload:
    tool_call = ai_json.get("choices", [{}])[0].get("message", {}).get("tool_calls", [{}])[0]
    arguments = tool_call.get("function", {}).get("arguments")
    if not arguments:
        raise ValueError("AI did not return a lesson")
    return LessonPayload.model_validate(normalize_lesson(json.loads(arguments)))


async def build_lesson_from_topic(topic: str) -> LessonPayload:
    return parse_lesson_generation(await ai_chat(lesson_generation_payload(topic)))


@app.get("/health")
async def health() -> dict[str, str]:
    return {"ok": "true"}


@app.post("/api/generate-lesson")
async def generate_lesson(body: GenerateLessonInput, authorization: str | None = Header(default=None)) -> dict[str, bool]:
    configured()
    token = bearer_token(authorization)
    async with httpx.AsyncClient(timeout=30) as client:
        await ensure_user(client, token)
        lesson = await supabase_request(
            client,
            token,
            "GET",
            "/rest/v1/lessons",
            params={"id": f"eq.{body.lessonId}", "select": "id,status"},
        )
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")

        try:
            lesson_data = await build_lesson_from_topic(body.topic)

            await supabase_request(
                client,
                token,
                "PATCH",
                "/rest/v1/lessons",
                params={"id": f"eq.{body.lessonId}"},
                json_body={"title": lesson_data.title, "summary": lesson_data.summary, "status": "ready", "error": None},
            )
            sections = [
                {
                    "lesson_id": str(body.lessonId),
                    "order_index": index,
                    "heading": section.heading,
                    "script": section.script,
                    "estimated_duration_s": section.estimated_duration_s,
                    "whiteboard": [event.model_dump(by_alias=True, exclude_none=True) for event in section.whiteboard],
                    "sources": [source.model_dump() for source in section.sources],
                }
                for index, section in enumerate(lesson_data.sections)
            ]
            await supabase_request(client, token, "POST", "/rest/v1/lesson_sections", json_body=sections)
            return {"ok": True}
        except Exception as err:
            message = str(err)
            await supabase_request(
                client,
                token,
                "PATCH",
                "/rest/v1/lessons",
                params={"id": f"eq.{body.lessonId}"},
                json_body={"status": "failed", "error": message[:500]},
            )
            if isinstance(err, HTTPException):
                raise err
            raise HTTPException(status_code=500, detail=message)


@app.post("/api/lesson-qa")
async def lesson_qa(body: LessonQaInput, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    configured()
    token = bearer_token(authorization)
    async with httpx.AsyncClient(timeout=30) as client:
        await ensure_user(client, token)
        lesson = await supabase_request(
            client,
            token,
            "GET",
            "/rest/v1/lessons",
            params={"id": f"eq.{body.lessonId}", "select": "title,summary"},
        )
        section = await supabase_request(
            client,
            token,
            "GET",
            "/rest/v1/lesson_sections",
            params={"id": f"eq.{body.sectionId}", "select": "heading,script"},
        )
        if not lesson or not section:
            raise HTTPException(status_code=404, detail="Not found")

        await supabase_request(
            client,
            token,
            "POST",
            "/rest/v1/lesson_messages",
            json_body={
                "lesson_id": str(body.lessonId),
                "section_id": str(body.sectionId),
                "role": "user",
                "content": body.question,
                "pinned_element_id": body.pinnedElements[0].id if body.pinnedElements else None,
            },
        )

        board_context = ""
        if body.whiteboardSnapshot:
            board_context = (
                "\n\nCurrent whiteboard state (cite by id when relied on):\n"
                + "\n".join(
                    f"  - id={item.id} ({item.type}) {item.summary}"
                    for item in body.whiteboardSnapshot
                )
            )
        pinned_context = ""
        if body.pinnedElements:
            pinned_context = "\n\nThe learner explicitly selected these whiteboard items:\n" + "\n".join(
                f"  - id={item.id} ({item.type}) {item.summary}" for item in body.pinnedElements
            )
        sources_context = ""
        if body.availableSources:
            sources_context = (
                "\n\nLesson sources available for citation (cite by url when relied on):\n"
                + "\n".join(
                    f"  - url={src.url} — {src.title}" for src in body.availableSources
                )
            )

        timeline_context = ""
        if body.spokenSoFar:
            elapsed_label = (
                f" (paused at {body.elapsedSeconds:.1f}s into the section)"
                if body.elapsedSeconds is not None
                else ""
            )
            timeline_context = f"\n\nWhat the learner has heard so far in this section{elapsed_label}:\n{body.spokenSoFar}"
        if body.recentEmphasis:
            timeline_context += (
                "\n\n*** MOST RECENT WORDS — the learner asked their question right after hearing this, "
                "so weigh this passage most heavily when answering: ***\n"
                f"{body.recentEmphasis}"
            )

        lesson_row = lesson[0]
        section_row = section[0]
        full_script = section_row.get("script") or ""
        script_block = (
            f"Section script you just delivered: {full_script}"
            if not body.spokenSoFar
            else "(See the timeline excerpt below — do not reference content the learner hasn't heard yet.)"
        )
        system_prompt = f"""You are the AI tutor mid-lesson. Answer the learner's question briefly and conversationally in 2-4 sentences. Stay grounded in the current lesson context. Speak as if continuing the live lesson, with no preamble.

Always call the respond_with_citations tool. Populate citedBoardIds with whiteboard ids you actually used (prefer items the learner just heard or pinned). Populate citedSourceUrls with source urls you actually relied on. If you didn't use any, return empty arrays — do not invent citations.

Lesson: {lesson_row.get("title")}
Summary: {lesson_row.get("summary")}
Current section: {section_row.get("heading")}
{script_block}{board_context}{pinned_context}{sources_context}{timeline_context}"""

        ai_json = await ai_chat({
            "model": AI_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": body.question},
            ],
            "tools": [QA_TOOL_SCHEMA],
            "tool_choice": {"type": "function", "function": {"name": "respond_with_citations"}},
        })

        answer = "Sorry, I couldn't answer that."
        cited_board_ids: list[str] = []
        cited_source_urls: list[str] = []
        try:
            tool_call = ai_json.get("choices", [{}])[0].get("message", {}).get("tool_calls", [{}])[0]
            args = json.loads(tool_call.get("function", {}).get("arguments") or "{}")
            answer = (args.get("answer") or answer).strip()
            valid_board = {item.id for item in body.whiteboardSnapshot} | {item.id for item in body.pinnedElements}
            valid_urls = {src.url for src in body.availableSources}
            cited_board_ids = [bid for bid in (args.get("citedBoardIds") or []) if isinstance(bid, str) and bid in valid_board]
            cited_source_urls = [u for u in (args.get("citedSourceUrls") or []) if isinstance(u, str) and u in valid_urls]
        except Exception:
            # Fall back to plain content if tool parsing fails
            content = ai_json.get("choices", [{}])[0].get("message", {}).get("content")
            if content:
                answer = content

        addendum = {"citedBoardIds": cited_board_ids, "citedSourceUrls": cited_source_urls}

        await supabase_request(
            client,
            token,
            "POST",
            "/rest/v1/lesson_messages",
            json_body={
                "lesson_id": str(body.lessonId),
                "section_id": str(body.sectionId),
                "role": "assistant",
                "content": answer,
                "whiteboard_addendum": addendum,
            },
        )
        return {"answer": answer, "citedBoardIds": cited_board_ids, "citedSourceUrls": cited_source_urls}
