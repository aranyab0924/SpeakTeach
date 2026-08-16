from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np

from app.schemas.analysis import SpeechEvent, SpeechEventType


@dataclass(frozen=True)
class AudioClip:
    """Normalized mono PCM ready for a detector.

    samples: float32, shape (n,), range roughly [-1, 1]
    sample_rate: 16000
    """

    samples: np.ndarray
    sample_rate: int
    duration_seconds: float


@dataclass(frozen=True)
class DetectionResult:
    """Detector output. HTTP AnalysisResult is built by analysis_service."""

    events: list[SpeechEvent]
    transcript: str = ""


class StutterDetector(ABC):
    """Swap MockStutterDetector for a real model without changing the HTTP API."""

    @abstractmethod
    def detect(self, audio: AudioClip) -> DetectionResult:
        raise NotImplementedError


class MockStutterDetector(StutterDetector):
    """Deterministic stand-in so the /analyze pipeline works before a real model.

    Ignores audio content. Places one repetition and one prolongation on a
    timeline scaled to the clip duration (same relative positions as the
    frontend mock fixture).
    """

    _BASELINE_SECONDS = 8.4
    _REPETITION = (1.2, 1.6, 0.86, "m-morning")
    _PROLONGATION = (4.1, 4.8, 0.79, "lake")

    def detect(self, audio: AudioClip) -> DetectionResult:
        duration = max(float(audio.duration_seconds), 0.5)
        scale = duration / self._BASELINE_SECONDS

        events = [
            self._scaled_event(
                "evt-1", SpeechEventType.repetition, *self._REPETITION, scale, duration
            ),
            self._scaled_event(
                "evt-2", SpeechEventType.prolongation, *self._PROLONGATION, scale, duration
            ),
        ]
        return DetectionResult(events=events, transcript="")

    @staticmethod
    def _scaled_event(
        event_id: str,
        event_type: SpeechEventType,
        start: float,
        end: float,
        confidence: float,
        text: str,
        scale: float,
        duration: float,
    ) -> SpeechEvent:
        scaled_start = round(min(start * scale, duration - 0.05), 3)
        scaled_end = round(min(end * scale, duration), 3)
        if scaled_end <= scaled_start:
            scaled_end = min(scaled_start + 0.05, duration)
        return SpeechEvent(
            id=event_id,
            type=event_type,
            start=max(scaled_start, 0.0),
            end=max(scaled_end, 0.0),
            confidence=confidence,
            text=text,
        )


def get_detector() -> StutterDetector:
    """Return the active detector.

    To switch to a real model later:
    1. Add RealStutterDetector(StutterDetector) in this package.
    2. Implement detect(self, audio: AudioClip) -> DetectionResult
       using audio.samples (mono float32) and audio.sample_rate (16000).
    3. Change the return below to RealStutterDetector().
    Do not change routers, schemas, or the HTTP contract.
    """
    return MockStutterDetector()
