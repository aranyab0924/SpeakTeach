const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined";
}

export function pickRecorderMimeType(): string | undefined {
  if (!isMediaRecorderSupported()) {
    return undefined;
  }
  return RECORDER_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function recordingFilename(blob: Blob): string {
  if (blob.type.includes("mp4")) {
    return "recording.m4a";
  }
  if (blob.type.includes("ogg")) {
    return "recording.ogg";
  }
  return "recording.webm";
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function permissionErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Could not access the microphone. Please try again.";
  }

  const name = "name" in error ? String(error.name) : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone access was blocked. Allow the mic for this site, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found. Plug one in or check system sound settings.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The microphone is busy or unreadable. Close other apps using it, then try again.";
  }
  if (name === "SecurityError") {
    return "The browser blocked the microphone. Use http://localhost or HTTPS.";
  }
  if (name === "OverconstrainedError") {
    return "This device does not support the requested microphone settings.";
  }
  if (!isMediaRecorderSupported()) {
    return "This browser cannot record audio. Try Chrome or Edge on this computer.";
  }

  return error.message || "Could not access the microphone. Please try again.";
}
