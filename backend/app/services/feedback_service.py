from app.schemas.analysis import AnalysisFeedback, AnalysisMetrics, SpeechEvent, SpeechEventType

_MAX_EVENT_OBSERVATIONS = 3


def generate_feedback(
    events: list[SpeechEvent],
    metrics: AnalysisMetrics,
    transcript: str,
) -> AnalysisFeedback:
    """Build deterministic, observational feedback from analysis output.

    Describes detected events and measured metrics only. Does not diagnose
    a medical condition or claim a cause.
    """
    ordered = sorted(events, key=lambda event: (event.start, event.end, event.id))
    return AnalysisFeedback(
        summary=_summary(metrics),
        strengths=_strengths(metrics, transcript),
        observations=_observations(ordered, metrics),
        next_step=_next_step(ordered, metrics),
    )


def _summary(metrics: AnalysisMetrics) -> str:
    total = metrics.total_events
    if total == 0:
        return "No repetition or prolongation events were detected in this recording."

    counts = _count_phrase(metrics.repetitions, metrics.prolongations)
    verb = "was" if total == 1 else "were"
    noun = "event" if total == 1 else "events"
    return f"{total} {noun} {verb} detected in this recording: {counts}."


def _strengths(metrics: AnalysisMetrics, transcript: str) -> list[str]:
    strengths = ["You completed the recording in one take."]
    if transcript.strip():
        strengths.append("A transcript was produced from this take.")
    if metrics.total_events == 0:
        strengths.append("No repetition or prolongation events were marked.")
    return strengths


def _observations(events: list[SpeechEvent], metrics: AnalysisMetrics) -> list[str]:
    observations: list[str] = []

    if not events:
        observations.append(
            "The detector did not mark repetition or prolongation intervals in this take."
        )
    else:
        for event in events[:_MAX_EVENT_OBSERVATIONS]:
            observations.append(_event_observation(event))
        remaining = len(events) - _MAX_EVENT_OBSERVATIONS
        if remaining > 0:
            extra = "event" if remaining == 1 else "events"
            observations.append(f"{remaining} additional {extra} were marked later in the recording.")

        early = sum(1 for event in events if event.start < 2.0)
        if early >= 2:
            observations.append("More than one event was marked in the first two seconds.")

    if metrics.speech_rate > 0:
        observations.append(
            f"Speech rate was measured at {metrics.speech_rate:g} words per minute."
        )

    pause_percent = round(metrics.pause_ratio * 100)
    observations.append(f"Pauses accounted for {pause_percent}% of the recording duration.")
    return observations


def _next_step(events: list[SpeechEvent], metrics: AnalysisMetrics) -> str:
    if metrics.total_events == 0 or not events:
        return "Try another prompt and keep a steady, unhurried pace."

    if metrics.repetitions > 0 and metrics.prolongations == 0:
        return (
            "Repeat this prompt once more. Ease into the words that were marked as repetitions."
        )
    if metrics.prolongations > 0 and metrics.repetitions == 0:
        return (
            "Repeat this prompt once more. Move through the marked sounds without holding them."
        )
    return (
        "Repeat this prompt once more. Ease into the first marked word "
        "and release the last marked sound without holding it."
    )


def _event_observation(event: SpeechEvent) -> str:
    label = _type_label(event.type)
    confidence_pct = round(event.confidence * 100)
    quoted = event.text.strip() or "an unmarked span"
    return (
        f"A {label} was marked from {event.start:.1f}s to {event.end:.1f}s "
        f"on “{quoted}” (confidence {confidence_pct}%)."
    )


def _type_label(event_type: SpeechEventType) -> str:
    if event_type == SpeechEventType.repetition:
        return "repetition"
    return "prolongation"


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
