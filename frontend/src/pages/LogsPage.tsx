import { useEffect, useState } from "react";
import { EventList } from "../components/EventList";
import { FeedbackCard } from "../components/FeedbackCard";
import { MetricsPanel } from "../components/MetricsPanel";
import { EXERCISES } from "../data/exercises";
import { useAuth } from "../hooks/useAuth";
import {
  getRecordingSignedUrl,
  listSessionEvents,
  listSessions,
  type SavedSession,
} from "../services/sessions";
import type { SpeechEvent } from "../types/analysis";

type LogsPageProps = {
  onGoToTraining: () => void;
  onGoToAccount: () => void;
};

export function LogsPage({ onGoToTraining, onGoToAccount }: LogsPageProps) {
  const { user, loading, configured } = useAuth();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || !user) {
      setSessions([]);
      setSelectedId(null);
      return;
    }

    let cancelled = false;
    setBusy(true);
    setError(null);

    listSessions()
      .then((rows) => {
        if (!cancelled) {
          setSessions(rows);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load sessions.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [configured, user]);

  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  if (!configured) {
    return (
      <main className="page">
        <h1>Logs</h1>
        <p className="error">Supabase is not configured. Check frontend/.env.local.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="page">
        <h1>Logs</h1>
        <p className="muted">Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page">
        <h1>Logs</h1>
        <section className="panel">
          <p>Sign in with email and password to see recordings and feedback.</p>
          <p className="muted">
            Logs are private. Row-level security only returns sessions for the
            signed-in account.
          </p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={onGoToAccount}>
              Go to account
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (selected) {
    return (
      <SessionDetail
        session={selected}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <main className="page">
      <h1>Logs</h1>
      <p className="muted">Saved practice sessions for {user.email}.</p>
      {busy ? <p className="muted">Loading…</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {!busy && sessions.length === 0 ? (
        <section className="panel">
          <p>No saved sessions yet.</p>
          <p className="muted">Finish an exercise, then save it from the results screen.</p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={onGoToTraining}>
              Back to training
            </button>
          </div>
        </section>
      ) : (
        <ul className="exercise-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                className="exercise-card"
                onClick={() => setSelectedId(session.id)}
              >
                <strong>{exerciseTitle(session.exercise_id)}</strong>
                <span className="muted">{formatWhen(session.created_at)}</span>
                <span className="muted">
                  {formatDuration(session.duration_seconds)} ·{" "}
                  {session.metrics?.total_events ?? 0} events
                  {session.audio_path ? " · recording saved" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function SessionDetail({
  session,
  onBack,
}: {
  session: SavedSession;
  onBack: () => void;
}) {
  const [events, setEvents] = useState<SpeechEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSessionEvents(session.id)
      .then((rows) => {
        if (!cancelled) {
          setEvents(rows);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setEventsError(caught instanceof Error ? caught.message : "Could not load events.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  return (
    <main className="page page-results">
      <button type="button" className="btn btn-link" onClick={onBack}>
        All logs
      </button>
      <h1>{exerciseTitle(session.exercise_id)}</h1>
      <p className="muted">{formatWhen(session.created_at)}</p>

      <SavedAudioPlayer audioPath={session.audio_path} />

      {session.metrics ? (
        <MetricsPanel
          metrics={session.metrics}
          durationSeconds={session.duration_seconds ?? 0}
        />
      ) : null}

      {session.transcript ? (
        <section className="panel">
          <h2>Transcript</h2>
          <p className="transcript">{session.transcript}</p>
        </section>
      ) : null}

      {eventsError ? (
        <p className="error" role="alert">
          {eventsError}
        </p>
      ) : (
        <EventList
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={(eventId) =>
            setSelectedEventId((current) => (current === eventId ? null : eventId))
          }
        />
      )}

      {session.feedback ? <FeedbackCard feedback={session.feedback} /> : (
        <section className="panel">
          <p className="muted">No feedback was stored with this session.</p>
        </section>
      )}
    </main>
  );
}

function SavedAudioPlayer({ audioPath }: { audioPath: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!audioPath) {
      setUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getRecordingSignedUrl(audioPath)
      .then((signed) => {
        if (!cancelled) {
          setUrl(signed);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load this recording.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioPath]);

  return (
    <section className="panel">
      <h2>Recording</h2>
      {!audioPath ? (
        <p className="muted">No audio was saved with this session.</p>
      ) : null}
      {loading ? <p className="muted">Loading recording…</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {url ? <audio className="playback" controls src={url} /> : null}
    </section>
  );
}

function exerciseTitle(exerciseId: string): string {
  return EXERCISES.find((exercise) => exercise.id === exerciseId)?.title ?? exerciseId;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) {
    return "unknown duration";
  }
  return `${seconds.toFixed(1)}s`;
}
