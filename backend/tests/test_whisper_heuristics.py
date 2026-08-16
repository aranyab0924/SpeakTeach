from unittest.mock import MagicMock

import numpy as np
import pytest

from app.core.errors import AnalyzeError
from app.ml.detector import AudioClip
from app.ml.whisper_detector import (
    TimedWord,
    WhisperStutterDetector,
    clip_timestamps_for_duration,
    detect_prolongations,
    detect_repetitions,
)
from app.schemas.analysis import SpeechEventType


def test_repetition_detects_back_to_back_words() -> None:
    words = [
        TimedWord("The", 0.2, 0.4, 0.9),
        TimedWord("the", 0.42, 0.6, 0.88),
        TimedWord("morning", 0.7, 1.1, 0.95),
    ]
    events = detect_repetitions(words)
    assert len(events) == 1
    assert events[0].type == SpeechEventType.repetition
    assert events[0].start == 0.2
    assert events[0].end == 0.6
    assert "the" in events[0].text.lower()


def test_repetition_detects_prefix_syllable() -> None:
    words = [
        TimedWord("m", 1.0, 1.15, 0.7),
        TimedWord("morning", 1.18, 1.6, 0.9),
    ]
    events = detect_repetitions(words)
    assert len(events) == 1
    assert events[0].type == SpeechEventType.repetition
    assert events[0].text == "m morning"


def test_repetition_allows_a_short_pause_between_words() -> None:
    words = [
        TimedWord("the", 0.2, 0.4, 0.9),
        TimedWord("the", 1.2, 1.4, 0.9),
        TimedWord("morning", 1.6, 2.0, 0.95),
    ]
    events = detect_repetitions(words)
    assert len(events) == 1
    assert events[0].text.lower() == "the the"


def test_repetition_detects_hyphenated_prefix() -> None:
    words = [TimedWord("m-morning", 1.0, 1.5, 0.8)]
    events = detect_repetitions(words)
    assert len(events) == 1
    assert events[0].text == "m-morning"


def test_repetition_detects_doubled_token() -> None:
    words = [TimedWord("thethe", 0.2, 0.5, 0.7), TimedWord("morning", 0.6, 1.0, 0.9)]
    events = detect_repetitions(words)
    assert len(events) == 1
    assert events[0].text == "thethe"


def test_prolongation_flags_unusually_long_word() -> None:
    words = [
        TimedWord("The", 0.0, 0.15, 0.9),
        TimedWord("morning", 0.2, 0.4, 0.9),
        TimedWord("light", 0.45, 0.6, 0.9),
        TimedWord("lake", 0.7, 1.5, 0.85),
    ]
    events = detect_prolongations(words)
    assert len(events) == 1
    assert events[0].type == SpeechEventType.prolongation
    assert events[0].text == "lake"
    assert events[0].confidence >= 0.70


def test_prolongation_drops_mildly_long_word() -> None:
    words = [
        TimedWord("The", 0.0, 0.2, 0.99),
        TimedWord("morning", 0.2, 0.45, 0.99),
        TimedWord("light", 0.45, 0.65, 0.99),
        TimedWord("across", 0.7, 1.18, 0.99),
        TimedWord("the", 1.2, 1.35, 0.99),
    ]
    events = detect_prolongations(words)
    assert all(event.text != "across" for event in events)


def test_prolongation_flags_held_word_even_when_speech_is_slow() -> None:
    words = [
        TimedWord("The", 0.0, 0.5, 0.9),
        TimedWord("morning", 0.6, 1.1, 0.9),
        TimedWord("lake", 1.2, 2.5, 0.85),
    ]
    events = detect_prolongations(words)
    assert any(event.text == "lake" and event.confidence >= 0.70 for event in events)


def test_clip_timestamps_split_at_and_above_whisper_chunk() -> None:
    # Under the 30s Whisper limit we do not call this helper, but windows stay < 30s.
    under = clip_timestamps_for_duration(29.9)
    assert under[-1]["end"] == 29.9
    assert all(w["end"] - w["start"] <= 29.0 + 1e-9 for w in under)

    windows = clip_timestamps_for_duration(30.0)
    assert windows[0] == {"start": 0.0, "end": 29.0}
    assert windows[-1]["end"] == 30.0
    assert all(w["end"] - w["start"] <= 29.0 + 1e-9 for w in windows)

    long_windows = clip_timestamps_for_duration(90.0)
    assert long_windows[0]["start"] == 0.0
    assert long_windows[-1]["end"] == 90.0
    assert sum(w["end"] - w["start"] for w in long_windows) == pytest.approx(90.0)


def test_asr_failure_raises_analyze_error_not_mock_events() -> None:
    detector = WhisperStutterDetector(model_size="tiny.en")
    detector._transcribe = MagicMock(  # type: ignore[method-assign]
        side_effect=RuntimeError(
            "No clip timestamps found. Set 'vad_filter' to True or provide 'clip_timestamps'."
        )
    )
    samples = np.zeros(16_000 * 35, dtype=np.float32)
    clip = AudioClip(samples=samples, sample_rate=16_000, duration_seconds=35.0)

    with pytest.raises(AnalyzeError) as caught:
        detector.detect(clip)

    assert caught.value.status_code == 422
    assert "transcribe" in caught.value.detail.lower()


def test_long_audio_passes_clip_timestamps_to_whisper() -> None:
    detector = WhisperStutterDetector(model_size="tiny.en")
    fake_model = MagicMock()
    fake_model.transcribe.return_value = (iter([]), MagicMock())
    detector._load_model = MagicMock(return_value=fake_model)  # type: ignore[method-assign]

    samples = np.zeros(16_000 * 45, dtype=np.float32)
    words = detector._transcribe(samples, sample_rate=16_000)

    assert words == []
    kwargs = fake_model.transcribe.call_args.kwargs
    assert kwargs["vad_filter"] is False
    assert "clip_timestamps" in kwargs
    assert kwargs["clip_timestamps"] == clip_timestamps_for_duration(45.0)


def test_short_audio_does_not_pass_clip_timestamps() -> None:
    detector = WhisperStutterDetector(model_size="tiny.en")
    fake_model = MagicMock()
    fake_model.transcribe.return_value = (iter([]), MagicMock())
    detector._load_model = MagicMock(return_value=fake_model)  # type: ignore[method-assign]

    samples = np.zeros(16_000 * 10, dtype=np.float32)
    detector._transcribe(samples, sample_rate=16_000)

    kwargs = fake_model.transcribe.call_args.kwargs
    assert "clip_timestamps" not in kwargs
