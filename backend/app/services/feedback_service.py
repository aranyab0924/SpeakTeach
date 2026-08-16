from app.schemas.analysis import AnalysisFeedback, AnalysisMetrics, SpeechEvent, SpeechEventType

_MAX_EVENT_OBSERVATIONS = 3


def generate_feedback(
    events: list[SpeechEvent],
    metrics: AnalysisMetrics,
    transcript: str,
) -> AnalysisFeedback:
    """Deterministic practice notes from detected events. Not a diagnosis."""
    ordered = sorted(events, key=lambda event: (event.start, event.end, event.id))
    return AnalysisFeedback(
        summary=_summary(metrics),
        strengths=_strengths(),
        observations=_observations(ordered, transcript),
        next_step=_next_step(ordered),
    )


def _summary(metrics: AnalysisMetrics) -> str:
    total = metrics.total_events
    if total == 0:
        return "No repetition or prolongation events were detected in this recording."

    counts = _count_phrase(metrics.repetitions, metrics.prolongations)
    verb = "was" if total == 1 else "were"
    noun = "event" if total == 1 else "events"
    return f"{total} {noun} {verb} detected in this recording: {counts}."


def _strengths() -> list[str]:
    return ["You finished the prompt."]


def _observations(events: list[SpeechEvent], transcript: str) -> list[str]:
    if not events:
        if transcript.strip():
            return [
                "Nothing in this take was marked as a repetition or a prolongation. "
                "That is a result for this recording only."
            ]
        return [
            "No words were transcribed, and no repetition or prolongation was marked. "
            "That is a result for this recording only."
        ]

    observations = [_event_observation(event) for event in events[:_MAX_EVENT_OBSERVATIONS]]
    remaining = len(events) - _MAX_EVENT_OBSERVATIONS
    if remaining > 0:
        extra = "event" if remaining == 1 else "events"
        observations.append(f"{remaining} more {extra} were marked later in the recording.")
    return observations


def _next_step(events: list[SpeechEvent]) -> str:
    if not events:
        return "Try the same prompt again. Start the first word with an easy, quiet onset."

    repetition = _first_of_type(events, SpeechEventType.repetition)
    prolongation = _first_of_type(events, SpeechEventType.prolongation)

    if repetition and not prolongation:
        return (
            f"Try the same prompt again. Use an easy onset on {_quote(repetition.text)} "
            "— start the sound quietly, then slide into the word."
        )
    if prolongation and not repetition:
        return (
            f"Try the same prompt again. On {_quote(prolongation.text)}, "
            "keep the sound moving instead of holding it."
        )
    assert repetition is not None and prolongation is not None
    return (
        f"Try the same prompt again. Easy onset on {_quote(repetition.text)}, "
        f"and don’t hold {_quote(prolongation.text)}."
    )


def _event_observation(event: SpeechEvent) -> str:
    label = "repetition" if event.type == SpeechEventType.repetition else "prolongation"
    confidence_pct = round(event.confidence * 100)
    return (
        f"A {label} was marked from {event.start:.1f}s to {event.end:.1f}s "
        f"on {_quote(event.text)} (confidence {confidence_pct}%)."
    )


def _first_of_type(events: list[SpeechEvent], event_type: SpeechEventType) -> SpeechEvent | None:
    for event in events:
        if event.type == event_type:
            return event
    return None


def _quote(text: str) -> str:
    cleaned = " ".join(text.split())
    if not cleaned:
        return "the marked word"
    return f"“{cleaned}”"


def _count_phrase(repetitions: int, prolongations: int) -> str:
    parts: list[str] = []
    if repetitions:
        noun = "repetition" if repetitions == 1 else "repetitions"
        parts.append(f"{repetitions} {noun}")
    if prolongations:
        noun = "prolongation" if prolongations == 1 else "prolongations"
        parts.append(f"{prolongations} {noun}")
    if not parts:
        return "no repetition or prolongation events"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} and {parts[1]}"
