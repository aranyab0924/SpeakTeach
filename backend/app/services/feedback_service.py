from app.schemas.analysis import AnalysisFeedback, AnalysisMetrics, SpeechEvent


def generate_feedback(
    events: list[SpeechEvent],
    metrics: AnalysisMetrics,
    transcript: str,
) -> AnalysisFeedback:
    """Deterministic mock. Agent 3 owns improvements to this file."""
    del events, transcript

    if metrics.total_events == 0:
        return AnalysisFeedback(
            summary="No stuttering events were detected in this recording.",
            strengths=["You completed the exercise in one take."],
            observations=[
                "This result is from the mock detector until the real model is wired in."
            ],
            next_step="Try the next exercise and keep a steady, unhurried pace.",
        )

    return AnalysisFeedback(
        summary=(
            f"Detected {metrics.repetitions} repetition(s) and "
            f"{metrics.prolongations} prolongation(s)."
        ),
        strengths=["You finished the full prompt."],
        observations=["Focus on the highlighted moments in the timeline."],
        next_step=(
            "Repeat this exercise once more, slowing down just before those moments."
        ),
    )
