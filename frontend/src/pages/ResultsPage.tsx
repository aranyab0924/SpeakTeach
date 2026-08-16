import { useMemo, useState } from "react";
import { EventList } from "../components/EventList";
import { EventTimeline } from "../components/EventTimeline";
import { FeedbackCard } from "../components/FeedbackCard";
import { MetricsPanel } from "../components/MetricsPanel";
import { NextExerciseCard } from "../components/NextExerciseCard";
import { TranscriptDisplay } from "../components/TranscriptDisplay";
import type { Exercise } from "../data/exercises";
import { useAuth } from "../hooks/useAuth";
import { recommendNextExercise } from "../services/results";
import { saveAnalysisResult } from "../services/sessions";
import type { AnalysisResult } from "../types/analysis";

type ResultsPageProps = {
  exercise: Exercise;
  result: AnalysisResult | null;
  audioBlob?: Blob | null;
  isLoading: boolean;
  error: string | null;
  onBackToExercises: () => void;
  onTryAgain: () => void;
  onSelectExercise: (exercise: Exercise) => void;
};

export function ResultsPage({
  exercise,
  result,
  audioBlob = null,
  isLoading,
  error,
  onBackToExercises,
  onTryAgain,
  onSelectExercise,
}: ResultsPageProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { user } = useAuth();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const suggestion = useMemo(() => {
    if (!result) {
      return null;
    }
    return recommendNextExercise(result.exercise_id, result.metrics);
  }, [result]);

  function handleSelectEvent(eventId: string): void {
    setSelectedEventId((current) => (current === eventId ? null : eventId));
  }

  function handleSelectExercise(exerciseId: string): void {
    if (!suggestion || suggestion.exercise.id !== exerciseId) {
      return;
    }
    onSelectExercise(suggestion.exercise);
  }

  if (isLoading) {
    return (
      <main className="page page-results">
        <Nav onBackToExercises={onBackToExercises} />
        <section className="panel" aria-busy="true" aria-live="polite">
          <h1>Analyzing your recording</h1>
          <p className="muted">Looking for repetition and prolongation events…</p>
          <div className="loading-bar" aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (error && !result) {
    return (
      <main className="page page-results">
        <Nav onBackToExercises={onBackToExercises} />
        <section className="panel" role="alert">
          <h1>Analysis could not be completed</h1>
          <p className="error">{error}</p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={onTryAgain}>
              Try again
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="page page-results">
        <Nav onBackToExercises={onBackToExercises} />
        <section className="panel">
          <h1>No results yet</h1>
          <p className="muted">Send a recording from the exercise page to see analysis here.</p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={onTryAgain}>
              Back to recorder
            </button>
          </div>
        </section>
      </main>
    );
  }

  const orderedEvents = [...result.events].sort((a, b) => a.start - b.start);

  return (
    <main className="page page-results">
      <Nav onBackToExercises={onBackToExercises} />
      <h1>Results</h1>
      <p className="muted">
        {exercise.title} · analysis {result.analysis_id}
      </p>

      <MetricsPanel metrics={result.metrics} durationSeconds={result.duration_seconds} />
      <EventTimeline
        events={orderedEvents}
        durationSeconds={result.duration_seconds}
        selectedEventId={selectedEventId}
        onSelectEvent={handleSelectEvent}
      />
      <TranscriptDisplay
        transcript={result.transcript}
        events={orderedEvents}
        selectedEventId={selectedEventId}
        onSelectEvent={handleSelectEvent}
      />
      <EventList
        events={orderedEvents}
        selectedEventId={selectedEventId}
        onSelectEvent={handleSelectEvent}
      />
      <FeedbackCard feedback={result.feedback} />
      <NextExerciseCard suggestion={suggestion} onSelectExercise={handleSelectExercise} />

      <SavePanel
        signedIn={Boolean(user)}
        saveState={saveState}
        saveMessage={saveMessage}
        onSave={() => {
          void (async () => {
            setSaveState("saving");
            setSaveMessage(null);
            try {
              const saved = await saveAnalysisResult(result, audioBlob);
              setSaveState("saved");
              if (saved.warning) {
                setSaveMessage(saved.warning);
              } else if (saved.audioSaved) {
                setSaveMessage("Saved to your log, including the recording.");
              } else {
                setSaveMessage("Saved to your log.");
              }
            } catch (caught) {
              setSaveState("error");
              setSaveMessage(
                caught instanceof Error ? caught.message : "Could not save this session.",
              );
            }
          })();
        }}
      />

      <div className="button-row">
        <button type="button" className="btn" onClick={onTryAgain}>
          Record again
        </button>
      </div>
    </main>
  );
}

function Nav({ onBackToExercises }: { onBackToExercises: () => void }) {
  return (
    <button type="button" className="btn btn-link" onClick={onBackToExercises}>
      All exercises
    </button>
  );
}

function SavePanel({
  signedIn,
  saveState,
  saveMessage,
  onSave,
}: {
  signedIn: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  saveMessage: string | null;
  onSave: () => void;
}) {
  return (
    <section className="panel">
      <h2>Save to your log</h2>
      {signedIn ? (
        <>
          <p className="muted">
            Stores this analysis in your private sessions table. Audio goes in the
            private recordings bucket when a blob is still available.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSave}
              disabled={saveState === "saving" || saveState === "saved"}
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : "Save session"}
            </button>
          </div>
          {saveMessage ? (
            <p className={saveState === "error" ? "error" : "muted"} role={saveState === "error" ? "alert" : undefined}>
              {saveMessage}
            </p>
          ) : null}
        </>
      ) : (
        <p className="muted">
          Sign in on the Account tab to save this result. Training still works
          without an account.
        </p>
      )}
    </section>
  );
}
