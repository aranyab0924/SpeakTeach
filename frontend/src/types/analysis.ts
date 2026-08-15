export type SpeechEventType = "repetition" | "prolongation";

export type SpeechEvent = {
  id: string;
  type: SpeechEventType;
  start: number;
  end: number;
  confidence: number;
  text: string;
};

export type AnalysisMetrics = {
  total_events: number;
  repetitions: number;
  prolongations: number;
  speech_rate: number;
  pause_ratio: number;
};

export type AnalysisFeedback = {
  summary: string;
  strengths: string[];
  observations: string[];
  next_step: string;
};

export type AnalysisResult = {
  analysis_id: string;
  exercise_id: string;
  duration_seconds: number;
  transcript: string;
  metrics: AnalysisMetrics;
  events: SpeechEvent[];
  patterns: string[];
  feedback: AnalysisFeedback;
};

export type HealthResponse = {
  status: string;
};
