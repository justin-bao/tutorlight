"""Langfuse eval for Tutorlight's core topic-to-lesson prompt flow.

Run with:
    python -m backend.evals.lesson_core_flow

Required env:
    AI_API_KEY
    LANGFUSE_PUBLIC_KEY
    LANGFUSE_SECRET_KEY

Optional env:
    AI_BASE_URL
    AI_MODEL
    LANGFUSE_BASE_URL
    LANGFUSE_DATASET_NAME
    LANGFUSE_RUN_NAME
    EVAL_FAIL_UNDER
"""

from __future__ import annotations

import os
import re
from statistics import mean
from typing import Any

from langfuse import Evaluation, get_client

from backend.main import AI_MODEL, build_lesson_from_topic, lesson_generation_payload


LOCAL_DATASET: list[dict[str, Any]] = [
    {
        "input": {"topic": "Photosynthesis for a curious middle schooler"},
        "expected_output": {
            "required_terms": ["photosynthesis", "light", "carbon dioxide", "glucose"],
            "audience": "middle school",
        },
        "metadata": {"domain": "science", "level": "middle-school"},
    },
    {
        "input": {"topic": "Solving linear equations with one variable"},
        "expected_output": {
            "required_terms": ["equation", "variable", "solve", "check"],
            "audience": "intro algebra",
        },
        "metadata": {"domain": "math", "level": "intro"},
    },
    {
        "input": {"topic": "How HTTP requests work for new web developers"},
        "expected_output": {
            "required_terms": ["request", "response", "server", "browser"],
            "audience": "beginner developers",
        },
        "metadata": {"domain": "programming", "level": "beginner"},
    },
]


def dataset_input(item: Any) -> dict[str, Any]:
    value = item.input if hasattr(item, "input") else item["input"]
    if isinstance(value, str):
        return {"topic": value}
    return value


def lesson_text(output: dict[str, Any]) -> str:
    lesson = output.get("lesson") or {}
    sections = lesson.get("sections") or []
    parts = [lesson.get("title", ""), lesson.get("summary", "")]
    for section in sections:
        parts.extend([section.get("heading", ""), section.get("script", "")])
    return " ".join(str(part) for part in parts).lower()


def words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9']+", text)


async def lesson_task(*, item: Any, **_: Any) -> dict[str, Any]:
    topic = dataset_input(item)["topic"]
    langfuse = get_client()
    payload = lesson_generation_payload(topic)

    try:
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="core-lesson-generation",
            input={"topic": topic, "messages": payload["messages"], "tools": ["build_lesson"]},
            model=AI_MODEL,
        ) as generation:
            lesson = await build_lesson_from_topic(topic)
            output = lesson.model_dump(mode="json")
            generation.update(output=output)
            return {"ok": True, "lesson": output}
    except Exception as err:
        return {"ok": False, "error": str(err)}


def schema_validity(*, output: dict[str, Any], **_: Any) -> Evaluation:
    return Evaluation(
        name="schema_validity",
        value=1.0 if output.get("ok") else 0.0,
        comment="Lesson parsed and passed the production Pydantic schema." if output.get("ok") else output.get("error", "Generation failed."),
    )


def section_count(*, output: dict[str, Any], **_: Any) -> Evaluation:
    sections = (output.get("lesson") or {}).get("sections") or []
    count = len(sections)
    return Evaluation(
        name="section_count",
        value=1.0 if 4 <= count <= 6 else 0.0,
        comment=f"Expected 4-6 sections from the core prompt; got {count}.",
    )


def script_length(*, output: dict[str, Any], **_: Any) -> Evaluation:
    sections = (output.get("lesson") or {}).get("sections") or []
    if not sections:
        return Evaluation(name="script_length", value=0.0, comment="No sections to score.")

    valid = 0
    comments = []
    for index, section in enumerate(sections, start=1):
        count = len(words(section.get("script", "")))
        if 80 <= count <= 160:
            valid += 1
        else:
            comments.append(f"s{index}={count} words")

    value = valid / len(sections)
    return Evaluation(
        name="script_length",
        value=value,
        comment="All scripts are 80-160 words." if not comments else "Out-of-range scripts: " + ", ".join(comments),
    )


def whiteboard_timeline(*, output: dict[str, Any], **_: Any) -> Evaluation:
    sections = (output.get("lesson") or {}).get("sections") or []
    if not sections:
        return Evaluation(name="whiteboard_timeline", value=0.0, comment="No whiteboard timelines to score.")

    valid = 0
    comments = []
    for section_index, section in enumerate(sections, start=1):
        events = section.get("whiteboard") or []
        ids = [event.get("id") for event in events]
        times = [event.get("at") for event in events if isinstance(event.get("at"), (int, float))]
        has_title_at_zero = bool(events and events[0].get("type") == "title" and events[0].get("at") == 0)
        unique_ids = len(ids) == len(set(ids))
        ordered = len(times) == len(events) and times == sorted(times)
        in_duration = all(0 <= event.get("at", -1) <= section.get("estimated_duration_s", 0) for event in events)
        if has_title_at_zero and unique_ids and ordered and in_duration:
            valid += 1
        else:
            comments.append(f"s{section_index}")

    value = valid / len(sections)
    return Evaluation(
        name="whiteboard_timeline",
        value=value,
        comment="All timelines are ordered with unique ids and a title at 0s." if not comments else "Timeline issues in: " + ", ".join(comments),
    )


def topic_coverage(*, input: dict[str, Any], output: dict[str, Any], expected_output: dict[str, Any] | None = None, **_: Any) -> Evaluation:
    expected_terms = (expected_output or {}).get("required_terms") or []
    text = lesson_text(output)
    if not output.get("ok") or not expected_terms:
        return Evaluation(name="topic_coverage", value=0.0, comment="No successful output or expected terms to score.")

    matched = [term for term in expected_terms if term.lower() in text]
    value = len(matched) / len(expected_terms)
    return Evaluation(
        name="topic_coverage",
        value=value,
        comment=f"Matched {len(matched)}/{len(expected_terms)} required terms for topic '{input.get('topic')}'.",
    )


def source_quality(*, output: dict[str, Any], **_: Any) -> Evaluation:
    if not output.get("ok"):
        return Evaluation(name="source_quality", value=0.0, comment="Generation failed before sources could be scored.")

    sections = (output.get("lesson") or {}).get("sections") or []
    sources = [source for section in sections for source in section.get("sources", [])]
    if not sources:
        return Evaluation(name="source_quality", value=0.75, comment="No sources supplied; allowed by schema but worth watching.")

    valid = [source for source in sources if source.get("title") and str(source.get("url", "")).startswith(("https://", "http://"))]
    return Evaluation(
        name="source_quality",
        value=len(valid) / len(sources),
        comment=f"{len(valid)}/{len(sources)} sources include titles and HTTP URLs.",
    )


def average_quality(*, item_results: list[Any], **_: Any) -> Evaluation:
    values = [
        evaluation.value
        for result in item_results
        for evaluation in result.evaluations
        if evaluation.value is not None and evaluation.name in {"schema_validity", "section_count", "script_length", "whiteboard_timeline", "topic_coverage", "source_quality"}
    ]
    score = mean(values) if values else None
    return Evaluation(
        name="average_quality",
        value=score,
        comment="Mean of structural and topic-coverage checks." if score is not None else "No item-level scores were produced.",
    )


def run_evaluations() -> None:
    langfuse = get_client()
    dataset_name = os.getenv("LANGFUSE_DATASET_NAME")
    run_name = os.getenv("LANGFUSE_RUN_NAME", "core-prompt-flow")
    evaluators = [schema_validity, section_count, script_length, whiteboard_timeline, topic_coverage, source_quality]

    if dataset_name:
        dataset = langfuse.get_dataset(dataset_name)
        result = dataset.run_experiment(
            name=run_name,
            description="Tutorlight core topic-to-lesson prompt flow eval.",
            task=lesson_task,
            evaluators=evaluators,
            run_evaluators=[average_quality],
            max_concurrency=2,
            metadata={"model": AI_MODEL, "flow": "topic-to-lesson"},
        )
    else:
        result = langfuse.run_experiment(
            name=run_name,
            description="Tutorlight core topic-to-lesson prompt flow eval on local smoke dataset.",
            data=LOCAL_DATASET,
            task=lesson_task,
            evaluators=evaluators,
            run_evaluators=[average_quality],
            max_concurrency=2,
            metadata={"model": AI_MODEL, "flow": "topic-to-lesson", "dataset": "local-smoke"},
        )

    print(result.format())
    if hasattr(langfuse, "flush"):
        langfuse.flush()

    threshold = os.getenv("EVAL_FAIL_UNDER")
    run_level_evaluations = getattr(result, "evaluations", [])
    average = next((evaluation.value for evaluation in run_level_evaluations if evaluation.name == "average_quality"), None)
    if threshold and average is not None and average < float(threshold):
        raise SystemExit(f"average_quality {average:.3f} is below EVAL_FAIL_UNDER={threshold}")


if __name__ == "__main__":
    run_evaluations()
