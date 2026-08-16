from app.schemas.analysis import AnalysisMetrics, SpeechEvent, SpeechEventType
from app.services.feedback_service import generate_feedback

_DIAGNOSIS_TERMS = (
    "disorder",
    "diagnosis",
    "diagnosed",
    "caused by",
    "anxiety",
    "medical condition",
    "you have a stutter",
    "symptom",
    "fluent",
    "cured",
)


def _metrics(
    *,
    total_events: int = 0,
    repetitions: int = 0,
    prolongations: int = 0,
    speech_rate: float = 110.0,
    pause_ratio: float = 0.18,
) -> AnalysisMetrics:
    return AnalysisMetrics(
        total_events=total_events,
        repetitions=repetitions,
        prolongations=prolongations,
        speech_rate=speech_rate,
        pause_ratio=pause_ratio,
    )


def _event(
    event_id: str,
    event_type: SpeechEventType,
    start: float,
    end: float,
    text: str,
    confidence: float = 0.8,
) -> SpeechEvent:
    return SpeechEvent(
        id=event_id,
        type=event_type,
        start=start,
        end=end,
        confidence=confidence,
        text=text,
    )


def _all_text(feedback) -> str:
    return " ".join(
        [
            feedback.summary,
            *feedback.strengths,
            *feedback.observations,
            feedback.next_step,
        ]
    ).lower()


def test_zero_events_does_not_claim_fluency() -> None:
    metrics = _metrics()
    first = generate_feedback([], metrics, "The morning light moved across the quiet lake.")
    second = generate_feedback([], metrics, "The morning light moved across the quiet lake.")

    assert first == second
    assert first.summary == "No repetition or prolongation events were detected in this recording."
    assert first.strengths == ["You finished the prompt."]
    assert "this recording only" in " ".join(first.observations)
    assert "fluent" not in _all_text(first)
    assert "cured" not in _all_text(first)
    assert first.next_step.startswith("Try the same prompt again.")
    assert "easy, quiet onset" in first.next_step


def test_zero_events_without_transcript() -> None:
    feedback = generate_feedback([], _metrics(), "")
    assert any("No words were transcribed" in item for item in feedback.observations)


def test_mixed_events_quote_timestamps_and_text() -> None:
    events = [
        _event("evt-1", SpeechEventType.repetition, 1.2, 1.6, "m-morning", 0.86),
        _event("evt-2", SpeechEventType.prolongation, 4.1, 4.8, "lake", 0.79),
    ]
    metrics = _metrics(total_events=2, repetitions=1, prolongations=1)
    feedback = generate_feedback(
        events, metrics, "The morning light moved across the quiet lake."
    )

    assert feedback.summary == (
        "2 events were detected in this recording: 1 repetition and 1 prolongation."
    )
    assert any("repetition was marked from 1.2s to 1.6s" in item for item in feedback.observations)
    assert any("prolongation was marked from 4.1s to 4.8s" in item for item in feedback.observations)
    assert "m-morning" in " ".join(feedback.observations)
    assert "lake" in " ".join(feedback.observations)
    assert feedback.next_step == (
        "Try the same prompt again. Easy onset on “m-morning”, and don’t hold “lake”."
    )


def test_repetition_only_next_step_quotes_the_word() -> None:
    events = [_event("evt-1", SpeechEventType.repetition, 0.4, 0.9, "the the")]
    metrics = _metrics(total_events=1, repetitions=1, prolongations=0)
    feedback = generate_feedback(events, metrics, "the the morning")
    assert "1 event was detected" in feedback.summary
    assert "easy onset on “the the”" in feedback.next_step


def test_prolongation_only_next_step_quotes_the_word() -> None:
    events = [_event("evt-1", SpeechEventType.prolongation, 2.0, 2.6, "walk")]
    metrics = _metrics(total_events=1, repetitions=0, prolongations=1)
    feedback = generate_feedback(events, metrics, "Today I went for a walk.")
    assert "1 prolongation" in feedback.summary
    assert "On “walk”, keep the sound moving instead of holding it." in feedback.next_step


def test_caps_event_observations_and_notes_remainder() -> None:
    events = [
        _event("evt-1", SpeechEventType.repetition, 0.2, 0.4, "a"),
        _event("evt-2", SpeechEventType.repetition, 0.5, 0.7, "b"),
        _event("evt-3", SpeechEventType.prolongation, 1.0, 1.4, "c"),
        _event("evt-4", SpeechEventType.prolongation, 3.0, 3.4, "d"),
        _event("evt-5", SpeechEventType.repetition, 4.0, 4.2, "e"),
    ]
    metrics = _metrics(total_events=5, repetitions=3, prolongations=2)
    feedback = generate_feedback(events, metrics, "a b c d e")
    event_lines = [item for item in feedback.observations if "was marked from" in item]
    assert len(event_lines) == 3
    assert any("2 more events were marked later" in item for item in feedback.observations)


def test_same_inputs_always_match() -> None:
    events = [
        _event("evt-2", SpeechEventType.prolongation, 4.1, 4.8, "lake", 0.79),
        _event("evt-1", SpeechEventType.repetition, 1.2, 1.6, "m-morning", 0.86),
    ]
    metrics = _metrics(total_events=2, repetitions=1, prolongations=1)
    transcript = "The morning light moved across the quiet lake."
    assert generate_feedback(events, metrics, transcript) == generate_feedback(
        list(reversed(events)), metrics, transcript
    )


def test_feedback_does_not_diagnose() -> None:
    events = [
        _event("evt-1", SpeechEventType.repetition, 1.2, 1.6, "m-morning", 0.86),
        _event("evt-2", SpeechEventType.prolongation, 4.1, 4.8, "lake", 0.79),
    ]
    metrics = _metrics(total_events=2, repetitions=1, prolongations=1)
    text = _all_text(
        generate_feedback(events, metrics, "The morning light moved across the quiet lake.")
    )
    for term in _DIAGNOSIS_TERMS:
        assert term not in text
