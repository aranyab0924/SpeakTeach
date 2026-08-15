import uuid

from app.ml.detector import MockStutterDetector, StutterDetector
from app.schemas.analysis import AnalysisResult, AnalysisMetrics, SpeechEventType
from app.services import audio_service, feedback_service

_detector: StutterDetector = MockStutterDetector()


def analyze(audio_bytes: bytes, content_type: str, exercise_id: str) -> AnalysisResult:
    preprocessed = audio_service.preprocess_audio(audio_bytes, content_type)
    duration_seconds = preprocessed.duration_seconds or 5.0
    events = _detector.detect(preprocessed.audio_bytes, duration_seconds)

    repetitions = sum(1 for event in events if event.type == SpeechEventType.repetition)
    prolongations = sum(
        1 for event in events if event.type == SpeechEventType.prolongation
    )
    metrics = AnalysisMetrics(
        total_events=len(events),
        repetitions=repetitions,
        prolongations=prolongations,
        speech_rate=0.0,
        pause_ratio=0.0,
    )
    feedback = feedback_service.generate_feedback(events, metrics, "")

    return AnalysisResult(
        analysis_id=str(uuid.uuid4()),
        exercise_id=exercise_id,
        duration_seconds=duration_seconds,
        transcript="",
        metrics=metrics,
        events=events,
        patterns=[],
        feedback=feedback,
    )
