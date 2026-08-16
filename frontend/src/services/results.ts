import { EXERCISES, type Exercise } from "../data/exercises";
import type { AnalysisMetrics, SpeechEvent, SpeechEventType } from "../types/analysis";

export type TranscriptSpan = {
  text: string;
  eventId?: string;
  type?: SpeechEventType;
};

export type NextExerciseSuggestion = {
  exercise: Exercise;
  reason: string;
};

export function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0.0s";
  }
  return `${value.toFixed(1)}s`;
}

export function formatSpeechRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  return `${Math.round(value)} wpm`;
}

export function formatPauseRatio(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

export function formatConfidence(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

export function eventTypeLabel(type: SpeechEventType): string {
  return type === "repetition" ? "Repetition" : "Prolongation";
}

export function eventSearchTerm(text: string): string {
  const parts = text
    .trim()
    .split(/[-–—]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? text.trim();
}

export function buildTranscriptSpans(
  transcript: string,
  events: SpeechEvent[],
): TranscriptSpan[] {
  if (!transcript) {
    return [];
  }

  const used = Array.from({ length: transcript.length }, () => false);
  const marks: { start: number; end: number; event: SpeechEvent }[] = [];

  for (const event of [...events].sort((a, b) => a.start - b.start)) {
    const term = eventSearchTerm(event.text);
    if (!term) {
      continue;
    }
    const index = findUnusedMatch(transcript, term, used);
    if (index < 0) {
      continue;
    }
    const end = index + term.length;
    for (let i = index; i < end; i += 1) {
      used[i] = true;
    }
    marks.push({ start: index, end, event });
  }

  marks.sort((a, b) => a.start - b.start);

  const spans: TranscriptSpan[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) {
      spans.push({ text: transcript.slice(cursor, mark.start) });
    }
    spans.push({
      text: transcript.slice(mark.start, mark.end),
      eventId: mark.event.id,
      type: mark.event.type,
    });
    cursor = mark.end;
  }
  if (cursor < transcript.length) {
    spans.push({ text: transcript.slice(cursor) });
  }
  return spans;
}

export function recommendNextExercise(
  currentExerciseId: string,
  metrics: AnalysisMetrics,
): NextExerciseSuggestion | null {
  const reading = EXERCISES.find((exercise) => exercise.id === "ex-reading-1");
  const intro = EXERCISES.find((exercise) => exercise.id === "ex-intro-1");

  if (metrics.repetitions > metrics.prolongations && reading && reading.id !== currentExerciseId) {
    return {
      exercise: reading,
      reason:
        "Repetition events were more common in this take. Easy onset reading practices a gentle start on each word.",
    };
  }

  if (metrics.prolongations > metrics.repetitions && intro && intro.id !== currentExerciseId) {
    return {
      exercise: intro,
      reason:
        "Prolongation events were more common in this take. A short introduction practices pausing between sentences.",
    };
  }

  const currentIndex = EXERCISES.findIndex((exercise) => exercise.id === currentExerciseId);
  const next =
    currentIndex >= 0
      ? EXERCISES[(currentIndex + 1) % EXERCISES.length]
      : EXERCISES.find((exercise) => exercise.id !== currentExerciseId);

  if (!next || next.id === currentExerciseId) {
    return null;
  }

  const reason =
    metrics.total_events === 0
      ? "No repetition or prolongation events were marked. A different prompt keeps practice moving."
      : "Try a different prompt to keep practicing the same unhurried pace.";

  return { exercise: next, reason };
}

function findUnusedMatch(transcript: string, term: string, used: boolean[]): number {
  const haystack = transcript.toLowerCase();
  const needle = term.toLowerCase();
  let from = 0;

  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) {
      return -1;
    }
    const taken = used.slice(index, index + needle.length).some(Boolean);
    if (!taken) {
      return index;
    }
    from = index + 1;
  }

  return -1;
}
