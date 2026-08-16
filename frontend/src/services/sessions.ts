import type { AnalysisFeedback, AnalysisMetrics, AnalysisResult, SpeechEvent } from "../types/analysis";
import { recordingFilename } from "./audio";
import { requireSupabase } from "../lib/supabase";

export type SavedSession = {
  id: string;
  exercise_id: string;
  duration_seconds: number | null;
  transcript: string | null;
  metrics: AnalysisMetrics;
  feedback: AnalysisFeedback;
  audio_path: string | null;
  created_at: string;
};

export async function listSessions(): Promise<SavedSession[]> {
  const { data, error } = await requireSupabase()
    .from("sessions")
    .select(
      "id, exercise_id, duration_seconds, transcript, metrics, feedback, audio_path, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as SavedSession[];
}

export async function saveAnalysisResult(
  result: AnalysisResult,
  audio?: Blob | null,
): Promise<{ sessionId: string; audioSaved: boolean; warning: string | null }> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("You need to be signed in to save a session.");
  }

  const { data: session, error: sessionError } = await client
    .from("sessions")
    .insert({
      user_id: userData.user.id,
      exercise_id: result.exercise_id,
      duration_seconds: result.duration_seconds,
      transcript: result.transcript,
      metrics: result.metrics,
      feedback: result.feedback,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message || "Could not save the session.");
  }

  if (result.events.length > 0) {
    const { error: eventsError } = await client.from("stutter_events").insert(
      result.events.map((event) => ({
        session_id: session.id,
        type: event.type,
        start_seconds: event.start,
        end_seconds: event.end,
        confidence: event.confidence,
        text: event.text,
      })),
    );
    if (eventsError) {
      throw new Error(eventsError.message);
    }
  }

  let audioSaved = false;
  let warning: string | null = null;
  if (audio && audio.size > 0) {
    const filename = recordingFilename(audio);
    const extension = filename.includes(".") ? filename.split(".").pop() : "webm";
    const path = `${userData.user.id}/${session.id}.${extension}`;
    const { error: uploadError } = await client.storage.from("recordings").upload(path, audio, {
      contentType: audio.type || "audio/webm",
      upsert: true,
    });
    if (uploadError) {
      warning = `Session saved, but the audio file could not be uploaded: ${uploadError.message}`;
      return { sessionId: session.id, audioSaved: false, warning };
    }
    const { error: pathError } = await client
      .from("sessions")
      .update({ audio_path: path })
      .eq("id", session.id);
    if (pathError) {
      warning = `Session saved, but the audio path could not be stored: ${pathError.message}`;
      return { sessionId: session.id, audioSaved: false, warning };
    }
    audioSaved = true;
  }

  return { sessionId: session.id, audioSaved, warning };
}

const SIGNED_URL_SECONDS = 300;

export async function listSessionEvents(sessionId: string): Promise<SpeechEvent[]> {
  const { data, error } = await requireSupabase()
    .from("stutter_events")
    .select("id, type, start_seconds, end_seconds, confidence, text")
    .eq("session_id", sessionId)
    .order("start_seconds", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    type: row.type === "prolongation" ? "prolongation" : "repetition",
    start: Number(row.start_seconds),
    end: Number(row.end_seconds),
    confidence: Number(row.confidence ?? 0),
    text: String(row.text ?? ""),
  }));
}

export async function getRecordingSignedUrl(audioPath: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from("recordings")
    .createSignedUrl(audioPath, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not create a playback link for this recording.");
  }
  return data.signedUrl;
}
