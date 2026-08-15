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
    summary:
      "Two stuttering events showed up in this reading: one repetition and one prolongation.",
    strengths: ["You completed the full sentence.", "Your overall pace stayed unhurried."],
    observations: [
      "The repetition happened near the start of a phrase.",
      "The prolongation landed on a final word.",
    ],
    next_step:
      "Read the same sentence once more. Ease into the first word and release the last word without holding it.",
  },
};
