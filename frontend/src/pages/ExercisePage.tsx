import { useState } from "react";
import type { Exercise } from "../data/exercises";
import { AudioRecorder } from "../components/AudioRecorder";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { ResultsPage } from "./ResultsPage";
import { analyzeAudio } from "../services/api";
import type { AnalysisResult } from "../types/analysis";

type ExercisePageProps = {
  exercise: Exercise;
  onBack: () => void;
  onSelectExercise: (exercise: Exercise) => void;
};

export function ExercisePage({ exercise, onBack, onSelectExercise }: ExercisePageProps) {
  const recorder = useAudioRecorder();
  const [view, setView] = useState<"record" | "results">("record");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function handleSubmit(): Promise<void> {
    if (!recorder.audioBlob) {
      setUploadError("Record a take before sending it for analysis.");
      return;
    }

    setView("results");
    setIsUploading(true);
    setUploadError(null);
    setResult(null);

    try {
      const analysis = await analyzeAudio(recorder.audioBlob, exercise.id);
      setResult(analysis);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not send the recording.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleReset(): void {
    recorder.reset();
    setUploadError(null);
    setResult(null);
    setView("record");
  }

  if (view === "results") {
    return (
      <ResultsPage
        exercise={exercise}
        result={result}
        audioBlob={recorder.audioBlob}
        isLoading={isUploading}
        error={uploadError}
        onBackToExercises={onBack}
        onTryAgain={handleReset}
        onSelectExercise={onSelectExercise}
      />
    );
  }

  return (
    <main className="page">
      <button type="button" className="btn btn-link" onClick={onBack}>
        All exercises
      </button>

      <h1>{exercise.title}</h1>
      <p className="prompt">{exercise.prompt}</p>
      <p className="muted">
        Read the prompt out loud. Start recording, speak at an unhurried pace, then stop.
      </p>

      <AudioRecorder
        status={recorder.status}
        elapsedMs={recorder.elapsedMs}
        audioUrl={recorder.audioUrl}
        error={recorder.error}
        disabled={isUploading}
        onStart={() => {
          setUploadError(null);
          setResult(null);
          void recorder.start();
        }}
        onStop={() => void recorder.stop()}
        onReset={handleReset}
      />

      <div className="button-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleSubmit()}
          disabled={!recorder.audioBlob || isUploading || recorder.status === "recording"}
        >
          {isUploading ? "Sending…" : "Send for analysis"}
        </button>
      </div>

      {uploadError ? (
        <p className="error" role="alert">
          {uploadError}
        </p>
      ) : null}
    </main>
  );
}
