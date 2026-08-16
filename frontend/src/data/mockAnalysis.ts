import type { AnalysisResult } from "../types/analysis";

export const MOCK_ANALYSIS_RESULT: AnalysisResult = {
  analysis_id: "mock-analysis-001",
  exercise_id: "ex-reading-1",
  duration_seconds: 8.4,
  transcript: "The morning light moved across the quiet lake.",
  metrics: {
    total_events: 2,
    repetitions: 1,
    prolongations: 1,
    speech_rate: 110,
    pause_ratio: 0.18,
  },
  events: [
    {
      id: "evt-1",
      type: "repetition",
      start: 1.2,
      end: 1.6,
      confidence: 0.86,
      text: "m-morning",
    },
    {
      id: "evt-2",
      type: "prolongation",
      start: 4.1,
      end: 4.8,
      confidence: 0.79,
      text: "lake",
    },
  ],
  patterns: [],
  feedback: {
    summary: "2 events were detected in this recording: 1 repetition and 1 prolongation.",
    strengths: [
      "You completed the recording in one take.",
      "A transcript was produced from this take.",
    ],
    observations: [
      "A repetition was marked from 1.2s to 1.6s on “m-morning” (confidence 86%).",
      "A prolongation was marked from 4.1s to 4.8s on “lake” (confidence 79%).",
      "Speech rate was measured at 110 words per minute.",
      "Pauses accounted for 18% of the recording duration.",
    ],
    next_step:
      "Repeat this prompt once more. Ease into the first marked word and release the last marked sound without holding it.",
  },
};
