import type { AnalysisResult, HealthResponse } from "../types/analysis";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function readError(response: Response): Promise<string> {
  const detail = await response.text();
  return detail || `${response.status} ${response.statusText}`;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/api/v1/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${await readError(response)}`);
  }
  return response.json() as Promise<HealthResponse>;
}

export async function analyzeAudio(
  file: Blob,
  exerciseId: string,
): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("file", file, "recording.webm");
  body.append("exercise_id", exerciseId);

  const response = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw new Error(`Analyze failed: ${await readError(response)}`);
  }
  return response.json() as Promise<AnalysisResult>;
}
