import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main  # noqa: E402


class FakeWord:
    def __init__(self, word, start, end, probability=0.9):
        self.word = word
        self.start = start
        self.end = end
        self.probability = probability


class FakeSegment:
    def __init__(
        self,
        segment_id,
        start,
        end,
        text,
        avg_logprob=None,
        no_speech_prob=None,
        compression_ratio=None,
        words=None,
    ):
        self.id = segment_id
        self.start = start
        self.end = end
        self.text = text
        self.avg_logprob = avg_logprob
        self.no_speech_prob = no_speech_prob
        self.compression_ratio = compression_ratio
        self.words = words or []


class TranscriptionEndpointTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_transcribes_uploaded_audio_with_vietnamese_default(self):
        fake_model = Mock()
        fake_model.transcribe.return_value = (
            [
                FakeSegment(1, 0.0, 1.2, " Xin chào nhóm "),
                FakeSegment(2, 1.2, 2.4, " hôm nay họp dự án. "),
            ],
            SimpleNamespace(language="vi", duration=2.4),
        )

        with patch.object(main, "get_whisper_model", return_value=fake_model):
            response = self.client.post(
                "/api/transcription/transcribe",
                files={"file": ("meeting.wav", b"fake wav bytes", "audio/wav")},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["language"], "vi")
        self.assertEqual(body["durationSeconds"], 2.4)
        self.assertEqual(body["text"], "Xin chào nhóm hôm nay họp dự án.")
        self.assertEqual(len(body["segments"]), 2)
        self.assertEqual(body["metadata"]["segmentCount"], 2)
        self.assertFalse(body["metadata"]["wordTimestamps"])
        fake_model.transcribe.assert_called_once()
        _, kwargs = fake_model.transcribe.call_args
        self.assertEqual(kwargs["language"], os.getenv("WHISPER_LANGUAGE", "vi"))
        self.assertTrue(kwargs["vad_filter"])
        self.assertFalse(kwargs["word_timestamps"])

    def test_allows_explicit_language_override(self):
        fake_model = Mock()
        fake_model.transcribe.return_value = (
            [FakeSegment(1, 0.0, 0.8, "hello")],
            SimpleNamespace(language="en", duration=0.8),
        )

        with patch.object(main, "get_whisper_model", return_value=fake_model):
            response = self.client.post(
                "/api/transcription/transcribe",
                data={"language": "en"},
                files={"file": ("meeting.wav", b"fake wav bytes", "audio/wav")},
            )

        self.assertEqual(response.status_code, 200)
        _, kwargs = fake_model.transcribe.call_args
        self.assertEqual(kwargs["language"], "en")

    def test_retries_uncertain_segments_with_clip_timestamps(self):
        fake_model = Mock()
        fake_model.transcribe.side_effect = [
            (
                [FakeSegment(1, 1.0, 2.0, "khong ro noi dung", avg_logprob=-1.2)],
                SimpleNamespace(language="vi", duration=3.0),
            ),
            (
                [FakeSegment(
                    1,
                    1.0,
                    2.0,
                    "không rõ nội dung",
                    avg_logprob=-0.2,
                    words=[FakeWord("không", 1.0, 1.2)],
                )],
                SimpleNamespace(language="vi", duration=1.0),
            ),
        ]

        with patch.object(main, "get_whisper_model", return_value=fake_model):
            response = self.client.post(
                "/api/transcription/transcribe",
                files={"file": ("meeting.wav", b"fake wav bytes", "audio/wav")},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["text"], "không rõ nội dung")
        self.assertEqual(body["metadata"]["retriedSegmentCount"], 1)
        self.assertTrue(body["segments"][0]["retried"])
        self.assertEqual(body["segments"][0]["originalText"], "khong ro noi dung")
        self.assertEqual(fake_model.transcribe.call_count, 2)
        _, retry_kwargs = fake_model.transcribe.call_args
        self.assertEqual(retry_kwargs["clip_timestamps"], "0.60,2.40")
        self.assertFalse(retry_kwargs["vad_filter"])

    def test_rejects_empty_audio_file(self):
        with patch.object(main, "get_whisper_model") as get_model:
            response = self.client.post(
                "/api/transcription/transcribe",
                files={"file": ("empty.wav", b"", "audio/wav")},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Audio file is empty")
        get_model.assert_not_called()

    def test_requires_file(self):
        response = self.client.post("/api/transcription/transcribe")

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
