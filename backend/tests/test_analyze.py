import io
import math
import struct
import subprocess
import wave

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.ml.detector import AudioClip, MockStutterDetector
from app.schemas.analysis import SpeechEventType
from app.services import audio_service

client = TestClient(app)


def _sine_wav_bytes(
    duration_seconds: float = 1.0,
    sample_rate: int = 16_000,
    channels: int = 1,
    frequency: float = 440.0,
) -> bytes:
    frame_count = int(duration_seconds * sample_rate)
    frames = bytearray()
    for i in range(frame_count):
        sample = int(0.2 * 32767 * math.sin(2 * math.pi * frequency * i / sample_rate))
        sample = max(-32768, min(32767, sample))
        packed = struct.pack("<h", sample)
        frames.extend(packed * channels)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(bytes(frames))
    return buffer.getvalue()


def test_health_ok() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_wav_returns_analysis_result() -> None:
    wav_bytes = _sine_wav_bytes(duration_seconds=2.0)
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("tone.wav", wav_bytes, "audio/wav")},
        data={"exercise_id": "ex-reading-1"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["exercise_id"] == "ex-reading-1"
    assert payload["analysis_id"]
    assert payload["duration_seconds"] == 2.0
    assert payload["transcript"] == "The morning light moved across the quiet lake."
    assert payload["patterns"] == []

    metrics = payload["metrics"]
    assert metrics["total_events"] == 2
    assert metrics["repetitions"] == 1
    assert metrics["prolongations"] == 1
    assert metrics["speech_rate"] > 0
    assert 0.0 <= metrics["pause_ratio"] <= 1.0

    events = payload["events"]
    types = {event["type"] for event in events}
    assert types == {"repetition", "prolongation"}
    for event in events:
        assert 0.0 <= event["start"] < event["end"] <= payload["duration_seconds"]
        assert 0.0 <= event["confidence"] <= 1.0
        assert event["text"]

    feedback = payload["feedback"]
    assert feedback["summary"]
    assert feedback["next_step"]


def test_analyze_webm_returns_analysis_result() -> None:
    import imageio_ffmpeg

    wav_bytes = _sine_wav_bytes(duration_seconds=1.5)
    completed = subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "wav",
            "-i",
            "pipe:0",
            "-c:a",
            "libopus",
            "-f",
            "webm",
            "pipe:1",
        ],
        input=wav_bytes,
        capture_output=True,
        check=True,
    )
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("recording.webm", completed.stdout, "audio/webm")},
        data={"exercise_id": "ex-reading-1"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["metrics"]["repetitions"] == 1
    assert payload["metrics"]["prolongations"] == 1
    assert abs(payload["duration_seconds"] - 1.5) < 0.15


def test_analyze_rejects_empty_file() -> None:
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("empty.wav", b"", "audio/wav")},
        data={"exercise_id": "ex-reading-1"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Empty audio file"


def test_analyze_rejects_unknown_exercise() -> None:
    wav_bytes = _sine_wav_bytes()
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("tone.wav", wav_bytes, "audio/wav")},
        data={"exercise_id": "not-a-real-exercise"},
    )
    assert response.status_code == 400
    assert "Unknown exercise_id" in response.json()["detail"]


def test_analyze_rejects_garbage_bytes() -> None:
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("junk.webm", b"this-is-not-audio", "audio/webm")},
        data={"exercise_id": "ex-reading-1"},
    )
    assert response.status_code == 400
    assert "detail" in response.json()


def test_preprocess_converts_stereo_wav_to_mono_16k() -> None:
    wav_bytes = _sine_wav_bytes(duration_seconds=1.0, sample_rate=8_000, channels=2)
    preprocessed = audio_service.preprocess_audio(wav_bytes, "audio/wav")
    clip = preprocessed.clip
    assert clip.sample_rate == 16_000
    assert clip.samples.ndim == 1
    assert clip.samples.dtype == np.float32
    assert abs(clip.duration_seconds - 1.0) < 0.02
    assert float(np.max(np.abs(clip.samples))) <= 1.0


def test_mock_detector_returns_repetition_and_prolongation() -> None:
    samples = np.zeros(16_000, dtype=np.float32)
    clip = AudioClip(samples=samples, sample_rate=16_000, duration_seconds=1.0)
    result = MockStutterDetector().detect(clip)
    assert len(result.events) == 2
    assert result.events[0].type == SpeechEventType.repetition
    assert result.events[1].type == SpeechEventType.prolongation
    for event in result.events:
        assert 0.0 <= event.start < event.end <= 1.0
        assert 0.0 < event.confidence <= 1.0
