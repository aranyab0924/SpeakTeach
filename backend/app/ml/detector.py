from abc import ABC, abstractmethod

from app.schemas.analysis import SpeechEvent


class StutterDetector(ABC):
    """Swap MockStutterDetector for a real model without changing the API."""

    @abstractmethod
    def detect(self, audio_bytes: bytes, duration_seconds: float) -> list[SpeechEvent]:
        raise NotImplementedError


class MockStutterDetector(StutterDetector):
    def detect(self, audio_bytes: bytes, duration_seconds: float) -> list[SpeechEvent]:
        del audio_bytes, duration_seconds
        return []
