import { useCallback, useEffect, useRef, useState } from "react";
import {
  isMediaRecorderSupported,
  permissionErrorMessage,
  pickRecorderMimeType,
} from "../services/audio";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "error";

type RecorderState = {
  status: RecorderStatus;
  elapsedMs: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
};

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useAudioRecorder(): RecorderState {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const revokeUrl = useCallback(() => {
    setAudioUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    stopStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
    revokeUrl();
    setAudioBlob(null);
    setElapsedMs(0);
    setError(null);
    setStatus("idle");
  }, [clearTimer, revokeUrl]);

  const start = useCallback(async () => {
    if (recorderRef.current?.state === "recording") {
      return;
    }

    if (!isMediaRecorderSupported()) {
      setError(permissionErrorMessage(new Error("MediaRecorder unsupported")));
      setStatus("error");
      return;
    }

    reset();
    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);

      recorder.start(250);
      setStatus("recording");
    } catch (caught) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setError(permissionErrorMessage(caught));
      setStatus("error");
    }
  }, [reset]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    clearTimer();
    stopStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;

    const blobType = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: blobType });
    chunksRef.current = [];

    if (blob.size === 0) {
      setError("The recording was empty. Please try again.");
      setStatus("error");
      return;
    }

    const url = URL.createObjectURL(blob);
    setAudioBlob(blob);
    setAudioUrl(url);
    setStatus("stopped");
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopStream(streamRef.current);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, clearTimer]);

  return {
    status,
    elapsedMs,
    audioBlob,
    audioUrl,
    error,
    start,
    stop,
    reset,
  };
}
