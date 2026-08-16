# Handoff: Auth + persistence

This is for the next agent working on SpeakTeach after frontend auth and
session saving were added.

Treat recordings, transcripts, and stutter events as sensitive /
medical-adjacent data.

## Product reminder

SpeakTeach is a practice tool for people who stutter. It does not replace
a speech therapist. FastAPI only analyzes audio. React talks to Supabase
for auth, saved sessions, and optional private audio.

## What is already done

- Exercise recorder and POST /api/v1/analyze
- Results UI (timeline, metrics, transcript, events, feedback)
- Lighter sepia shell with Training / Logs / Account tabs
- Email/password auth on the Account tab
- Save session from the results screen
- Logs list of the signed-in user's sessions
- Optional upload to private Storage bucket `recordings`

## Architecture (do not invert)

```
React  -->  Supabase Auth, sessions, stutter_events, recordings
React  -->  FastAPI POST /api/v1/analyze  -->  AnalysisResult  -->  React
```

FastAPI must not use Supabase, must not see user accounts, and must not
receive a service-role key.

The browser uses the **publishable / anon** key plus the user JWT.
RLS is the security boundary. Never put `service_role` / `sb_secret_`
in frontend code or git.

No `profiles` table. `auth.users.id` is the user.
No `exercises` table. Exercises stay in `frontend/src/data/exercises.ts`.

## Frozen contracts — do not rename

- `shared/API_CONTRACT.md`
- `shared/DATABASE.md`
- `frontend/src/types/analysis.ts`
- `backend/app/schemas/analysis.py`

AnalysisResult fields stay snake_case. Event `start` / `end` map to
database `start_seconds` / `end_seconds`.

## Env (local only)

File: `frontend/.env.local` (gitignored)

```
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Use the **new publishable** key, not secret/service_role.
`.env.example` at repo root is a blank template. Do not put real keys there.
Restart `npm run dev` after env changes.

## Key files

| File | Role |
| --- | --- |
| `frontend/src/lib/supabase.ts` | Browser client, no secret key |
| `frontend/src/hooks/AuthProvider.tsx` | Session provider |
| `frontend/src/hooks/useAuth.ts` | Current user hook |
| `frontend/src/services/auth.ts` | signUp / signIn / signOut |
| `frontend/src/services/sessions.ts` | save AnalysisResult, list sessions |
| `frontend/src/pages/AccountPage.tsx` | Login / signup / logout |
| `frontend/src/pages/LogsPage.tsx` | Progress list |
| `frontend/src/pages/ResultsPage.tsx` | Save to log (added; do not gut results UI) |
| `frontend/src/pages/ExercisePage.tsx` | Passes audio Blob into results for optional upload |
| `supabase/migrations/20260815120000_init_sessions.sql` | sessions + stutter_events + RLS |
| `docs/HUMAN_TEAM.md` | Beginner setup guide |

Storage path convention:

```
recordings / {user_id} / {session_id}.{webm|m4a|ogg}
```

First folder must equal `auth.uid()` or storage RLS will reject the upload.

## What you should not do

- Do not modify `backend/app/ml/` unless you are the analysis agent
- Do not change `/api/v1/analyze` shape
- Do not add Next.js, a Node backend, or `@supabase/ssr`
- Do not create extra CSS files; use `frontend/src/styles/theme.css`
- Do not call fetch/Supabase from large page components; keep calls in `services/`
- Do not commit `.env.local`, audio, or keys

## Suggested next work (pick one, keep it small)

1. Logs detail view: tap a session, show stored metrics/events/feedback.
   Load `stutter_events` by `session_id`. Do not invent new API fields.
2. Playback of saved audio via `supabase.storage.from('recordings').createSignedUrl`.
   Bucket is private; never make it public.
3. If signup says "check email", confirm Authentication → disable email
   confirmations for the hackathon demo, or keep the confirmation copy.
4. Prove RLS: User A saves a session. User B in incognito must see none of
   A's rows in Table Editor / Logs. If B can, stop and fix policies.
5. UI polish only if the demo loop already works end to end.

## How to test

1. `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload`
2. `cd frontend && npm run dev`
3. Account tab: sign up / sign in. Refresh. Still signed in. Sign out.
4. Training: record → send for analysis → Save session
5. Logs: the new row appears
6. Supabase Table Editor: `sessions` has `user_id`; `stutter_events` match
7. Storage: object under `{user_id}/...` in `recordings`
8. Second account cannot see the first user's log

## Ownership reminder

- Agent 1: recorder / exercise UI
- Agent 2: FastAPI ML pipeline
- Agent 3: results presentation (already built; save button was added beside it)
- Auth/persistence: this handoff. Keep FastAPI out of it.
