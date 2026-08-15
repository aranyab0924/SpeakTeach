from dataclasses import dataclass


@dataclass
class PreprocessedAudio:
    audio_bytes: bytes
    duration_seconds: float
    content_type: str


def preprocess_audio(audio_bytes: bytes, content_type: str) -> PreprocessedAudio:
    """Foundation stub. Agent 2 replaces this with real audio preprocessing."""
    return PreprocessedAudio(
        audio_bytes=audio_bytes,
        duration_seconds=0.0,
        content_type=content_type,
    )
