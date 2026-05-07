import json
import unittest
from uuid import uuid4

try:
    from fastapi import HTTPException
    from fastapi.testclient import TestClient

    import backend.main as main
except ModuleNotFoundError as exc:
    HTTPException = Exception
    TestClient = None
    main = None
    BACKEND_IMPORT_ERROR = exc
else:
    BACKEND_IMPORT_ERROR = None


@unittest.skipIf(BACKEND_IMPORT_ERROR is not None, f"Backend dependencies are not installed: {BACKEND_IMPORT_ERROR}")
class BackendUnitTests(unittest.TestCase):
    def test_bearer_token_rejects_missing_or_malformed_headers(self):
        with self.assertRaises(HTTPException) as ctx:
            main.bearer_token(None)

        self.assertEqual(ctx.exception.status_code, 401)

    def test_bearer_token_strips_valid_authorization_header(self):
        self.assertEqual(main.bearer_token("Bearer test-token "), "test-token")

    def test_normalize_event_infers_diagram_shape_and_edges(self):
        event = main.normalize_event(
            {
                "id": "custom-diagram",
                "shape": "mystery",
                "nodes": [{"name": "Input"}, {"label": "Output"}],
                "edges": [{"source": "n1", "target": "n2", "label": "then"}],
            },
            section_index=0,
            event_index=2,
        )

        self.assertEqual(event["type"], "diagram")
        self.assertEqual(event["shape"], "flow")
        self.assertEqual(event["nodes"][0]["label"], "Input")
        self.assertEqual(event["edges"][0]["from"], "n1")

    def test_parse_lesson_generation_accepts_normalizable_tool_arguments(self):
        sections = [
            {
                "heading": f"Section {index}",
                "script": "This section explains the concept in a concise, spoken way.",
                "estimated_duration_s": 45,
                "whiteboard": [{"title": f"Section {index}"}, {"label": "Key takeaway"}],
                "sources": [],
            }
            for index in range(1, 4)
        ]
        ai_json = {
            "choices": [
                {
                    "message": {
                        "tool_calls": [
                            {
                                "function": {
                                    "arguments": json.dumps(
                                        {
                                            "title": "A test lesson",
                                            "summary": "A concise lesson used by tests.",
                                            "sections": sections,
                                        }
                                    )
                                }
                            }
                        ]
                    }
                }
            ]
        }

        lesson = main.parse_lesson_generation(ai_json)

        self.assertEqual(lesson.title, "A test lesson")
        self.assertEqual(len(lesson.sections), 3)
        self.assertEqual(lesson.sections[0].whiteboard[0].type, "title")
        self.assertEqual(lesson.sections[0].whiteboard[1].type, "bullet")


@unittest.skipIf(BACKEND_IMPORT_ERROR is not None, f"Backend dependencies are not installed: {BACKEND_IMPORT_ERROR}")
class BackendIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_health_endpoint_reports_ok(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": "true"})

    def test_generate_lesson_requires_bearer_auth_after_configuration(self):
        previous = (main.SUPABASE_URL, main.SUPABASE_PUBLISHABLE_KEY, main.AI_API_KEY)
        main.SUPABASE_URL = "https://supabase.example.test"
        main.SUPABASE_PUBLISHABLE_KEY = "publishable-key"
        main.AI_API_KEY = "ai-key"
        try:
            response = self.client.post(
                "/api/generate-lesson",
                json={"lessonId": str(uuid4()), "topic": "Unit testing"},
            )
        finally:
            main.SUPABASE_URL, main.SUPABASE_PUBLISHABLE_KEY, main.AI_API_KEY = previous

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Unauthorized")


if __name__ == "__main__":
    unittest.main()
