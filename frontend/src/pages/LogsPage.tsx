import { useEffect, useState } from "react";
import { EXERCISES } from "../data/exercises";
import { useAuth } from "../hooks/useAuth";
import { listSessions, type SavedSession } from "../services/sessions";

type LogsPageProps = {
  onGoToTraining: () => void;
  onGoToAccount: () => void;
};

export function LogsPage({ onGoToTraining, onGoToAccount }: LogsPageProps) {
  const { user, loading, configured } = useAuth();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured || !user) {
      setSessions([]);
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
          <p>Sign in to see your practice history.</p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={onGoToAccount}>
              Go to account
            </button>
          </div>
        </section>
      </main>
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
              <article className="exercise-card">
                <strong>{exerciseTitle(session.exercise_id)}</strong>
                <span className="muted">{formatWhen(session.created_at)}</span>
                <span className="muted">
                  {formatDuration(session.duration_seconds)} ·{" "}
                  {session.metrics?.total_events ?? 0} events
                  {session.audio_path ? " · audio saved" : ""}
                </span>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
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
