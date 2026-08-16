import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { signIn, signOut, signUp } from "../services/auth";

type AccountPageProps = {
  onGoToTraining: () => void;
};

export function AccountPage({ onGoToTraining }: AccountPageProps) {
  const { user, loading, configured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signup") {
        const result = await signUp(email, password);
        if (result.needsConfirmation) {
          setNotice("Check your email to confirm the account, then sign in.");
        }
      } else {
        await signIn(email, password);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="page">
        <h1>Account</h1>
        <section className="panel">
          <p className="error" role="alert">
            Supabase is not configured. Add VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY to frontend/.env.local, then restart the
            frontend.
          </p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="page">
        <h1>Account</h1>
        <p className="muted">Checking your session…</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="page">
        <h1>Account</h1>
        <section className="panel">
          <p>Signed in as {user.email}</p>
          <p className="muted">
            Email and password is how we protect logs and recordings. There is
            no extra profile table — your auth user id is enough.
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="button-row">
            <button type="button" className="btn" onClick={() => void handleSignOut()} disabled={busy}>
              Sign out
            </button>
            <button type="button" className="btn btn-primary" onClick={onGoToTraining}>
              Back to training
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Account</h1>
      <section className="panel">
        <p className="muted">
          {mode === "signin"
            ? "Sign in with email and password to save sessions and play back your log."
            : "Create an account with email and password."}
        </p>
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className="muted">{notice}</p> : null}
          <div className="button-row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
            >
              {mode === "signin" ? "Need an account?" : "Have an account?"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
