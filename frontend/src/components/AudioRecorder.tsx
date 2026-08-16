import type { RecorderStatus } from "../hooks/useAudioRecorder";
import { formatElapsed } from "../services/audio";

type AudioRecorderProps = {
  status: RecorderStatus;
  elapsedMs: number;
  audioUrl: string | null;
  error: string | null;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
};

export function AudioRecorder({
  status,
  elapsedMs,
  audioUrl,
  error,
  disabled = false,
  onStart,
  onStop,
  onReset,
}: AudioRecorderProps) {
  const isRecording = status === "recording";
  const isRequesting = status === "requesting";

  return (
    <section className="panel" aria-label="Audio recorder">
      <div className="recorder-status">
        <span
          className={isRecording ? "status-dot recording" : "status-dot"}
          aria-hidden="true"
        />
        <p className="timer" aria-live="polite">
          {formatElapsed(elapsedMs)}
        </p>
        <p className="muted">{statusLabel(status)}</p>
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="button-row">
        {isRecording ? (
          <button type="button" className="btn btn-danger" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStart}
            disabled={disabled || isRequesting}
          >
            {audioUrl ? "Re-record" : "Start recording"}
          </button>
        )}
        {audioUrl ? (
          <button type="button" className="btn" onClick={onReset} disabled={isRecording}>
            Discard
          </button>
        ) : null}
      </div>

      {audioUrl ? <audio className="playback" controls src={audioUrl} /> : null}
    </section>
  );
}

function statusLabel(status: RecorderStatus): string {
  if (status === "requesting") {
    return "Asking for microphone access…";
  }
  if (status === "recording") {
    return "Recording";
  }
  if (status === "stopped") {
    return "Recording ready — listen back, then send it for analysis.";
  }
  if (status === "error") {
    return "Recorder error";
  }
  return "Not recording";
}
