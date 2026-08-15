from enum import Enum

from pydantic import BaseModel, Field


class SpeechEventType(str, Enum):
    repetition = "repetition"
    prolongation = "prolongation"


class SpeechEvent(BaseModel):
    id: str
    type: SpeechEventType
    start: float
    end: float
    confidence: float
    text: str


class AnalysisMetrics(BaseModel):
    total_events: int
    repetitions: int
    prolongations: int
    speech_rate: float
    pause_ratio: float


class AnalysisFeedback(BaseModel):
    summary: str
    strengths: list[str]
    observations: list[str]
    next_step: str


class AnalysisResult(BaseModel):
    analysis_id: str
    exercise_id: str
    duration_seconds: float
    transcript: str
    metrics: AnalysisMetrics
    events: list[SpeechEvent]
    patterns: list[str] = Field(default_factory=list)
    feedback: AnalysisFeedback
