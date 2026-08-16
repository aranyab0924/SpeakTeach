import uuid

from app.core.errors import AnalyzeError
from app.ml.detector import get_detector
from app.schemas.analysis import AnalysisMetrics, AnalysisResult, SpeechEvent, SpeechEventType
from app.services import audio_service, feedback_service

# Hardcoded exercise ids from frontend/src/data/exercises.ts (no exercises table).
_KNOWN_EXERCISE_IDS = frozenset({"ex-reading-1", "ex-intro-1"})

_FALLBACK_TRANSCRIPTS = {
    "ex-reading-1": "The morning light moved across the quiet lake.",
    "ex-intro-1": "My name is Alex and today I went for a walk.",
}

_detector = get_detector()


def analyze(audio_bytes: bytes, content_type: str, exercise_id: str) -> AnalysisResult:
    exercise_id = (exercise_id or "").strip()
    if not exercise_id:
        raise AnalyzeError("exercise_id is required")
    if exercise_id not in _KNOWN_EXERCISE_IDS:
        raise AnalyzeError(f"Unknown exercise_id: {exercise_id}")

    preprocessed = audio_service.preprocess_audio(audio_bytes, content_type)
    clip = preprocessed.clip
    detection = _detector.detect(clip)
    events = _sanitize_events(detection.events, clip.duration_seconds)

    transcript = detection.transcript.strip() or _FALLBACK_TRANSCRIPTS.get(exercise_id, "")
    repetitions = sum(1 for event in events if event.type == SpeechEventType.repetition)
    prolongations = sum(1 for event in events if event.type == SpeechEventType.prolongation)
    word_count = len(transcript.split()) if transcript else 0
    speech_rate = (
        round((word_count / clip.duration_seconds) * 60.0, 1)
        if clip.duration_seconds > 0
        else 0.0
    )

    metrics = AnalysisMetrics(
        total_events=len(events),
        repetitions=repetitions,
        prolongations=prolongations,
        speech_rate=speech_rate,
        pause_ratio=audio_service.estimate_pause_ratio(clip),
    )
    feedback = feedback_service.generate_feedback(events, metrics, transcript)

    return AnalysisResult(
        analysis_id=str(uuid.uuid4()),
        exercise_id=exercise_id,
        duration_seconds=clip.duration_seconds,
        transcript=transcript,
        metrics=metrics,
        events=events,
        patterns=[],
        feedback=feedback,
    )


def _sanitize_events(events: list[SpeechEvent], duration_seconds: float) -> list[SpeechEvent]:
    cleaned: list[SpeechEvent] = []
    for event in events:
        start = max(float(event.start), 0.0)
        end = min(float(event.end), duration_seconds)
        if end <= start:
            continue
        confidence = min(max(float(event.confidence), 0.0), 1.0)
        cleaned.append(
            event.model_copy(update={"start": start, "end": end, "confidence": confidence})
        )
    return cleaned
