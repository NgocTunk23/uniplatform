import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main  # noqa: E402


class SummaryEvaluationEndpointTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_summary_score_passes_when_score_above_threshold(self):
        with patch.object(main, "score_summary_with_ragas", return_value=0.81) as score_summary:
            response = self.client.post(
                "/api/evaluation/summarization-score",
                json={
                    "referenceContexts": ["Nội dung cuộc họp đã được duyệt."],
                    "response": "Tóm tắt cuộc họp.",
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["metric"], "ragas_summary_score")
        self.assertEqual(body["score"], 0.81)
        self.assertTrue(body["passed"])
        self.assertEqual(body["threshold"], 0.55)
        score_summary.assert_called_once()

    def test_summary_score_fails_when_score_below_threshold(self):
        with patch.object(main, "score_summary_with_ragas", return_value=0.2):
            response = self.client.post(
                "/api/evaluation/summarization-score",
                json={
                    "referenceContexts": ["Nội dung cuộc họp đã được duyệt."],
                    "response": "Tóm tắt sai.",
                    "coeff": 0.4,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["score"], 0.2)
        self.assertFalse(body["passed"])
        self.assertEqual(body["metadata"]["coeff"], 0.4)

    def test_rejects_empty_reference_contexts(self):
        with patch.object(main, "score_summary_with_ragas") as score_summary:
            response = self.client.post(
                "/api/evaluation/summarization-score",
                json={
                    "referenceContexts": ["  "],
                    "response": "Tóm tắt.",
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("referenceContexts", response.json()["detail"])
        score_summary.assert_not_called()

    def test_requires_response(self):
        response = self.client.post(
            "/api/evaluation/summarization-score",
            json={"referenceContexts": ["Nội dung"]},
        )

        self.assertEqual(response.status_code, 422)

    def test_surfaces_ragas_error_as_500(self):
        with patch.object(main, "score_summary_with_ragas", side_effect=RuntimeError("ollama unavailable")):
            response = self.client.post(
                "/api/evaluation/summarization-score",
                json={
                    "referenceContexts": ["Nội dung"],
                    "response": "Tóm tắt.",
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertIn("ollama unavailable", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
