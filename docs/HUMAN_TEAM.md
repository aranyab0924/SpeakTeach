# Human team guide: setup, auth, and saving practice logs

This is for the person building **sign up / login** and **saving completed practice sessions**. You do not need to know machine learning, and you do not need to change the Python backend.

You can follow this in Cursor. When you are stuck, paste the prompt at the bottom of this file into the chat and attach this document.

Recordings and transcripts are sensitive. Treat them like private medical-adjacent data.

---

## What SpeakTeach is

SpeakTeach helps people who stutter practice speaking.

1. The user signs in.
2. They do a speaking exercise and record themselves.
3. FastAPI (Python) analyzes the audio and returns an `AnalysisResult`.
4. The app shows feedback.
5. If the user wants a progress log, **your code** saves that result into Supabase.

You are not replacing a speech therapist. You are adding accounts and an optional history log.

---

## What you own vs what you must not touch

### You own

- Creating the Supabase project
- Email / password sign up, login, and logout
- Connecting React to Supabase
- Saving a completed `AnalysisResult` as:
  - one `sessions` row
  - several `stutter_events` rows
- Optional: private audio uploads to a `recordings` bucket
- Row Level Security (RLS) so users only see their own data

### You must not

- Change FastAPI / anything under `backend/` except if someone explicitly asks
- Add a `profiles` table (Supabase Auth already identifies the user)
- Add an `exercises` table (exercises are hardcoded in `frontend/src/data/exercises.ts`)
- Rename fields on `AnalysisResult`
- Put the Supabase **secret / service_role** key in the frontend, `.env.local`, GitHub, or chat
- Commit `.env`, `.env.local`, passwords, or audio files

Other people own:

- Agent 1: microphone + exercise UI
- Agent 2: speech analysis
- Agent 3: results / feedback screen

You can still add a login page and a "Save this session" button. Coordinate with Agent 3 so saving happens after results exist. Until then, you can test saving with the mock result in `frontend/src/data/mockAnalysis.ts`.

---

## How the architecture works

```
React  ---- login / signup / save session ---->  Supabase (Auth + database + storage)
React  ---- audio file POST /api/v1/analyze -->  FastAPI (speech only, no login)
```

FastAPI never sees the user account. After analysis, React already has the result in memory. Your job is: if the user is logged in, save it to Supabase using their session.

Security model:

- Frontend uses the **publishable / anon** key (safe to put in the browser **if RLS is on**)
- The user's login JWT tells Supabase who they are
- RLS policies enforce `this row belongs to auth.uid()`
- The secret/service_role key bypasses RLS. Do not use it for this MVP.

---

## Part 0 — Aranya: add your wife to GitHub

Do this once, before she clones.

1. She creates a GitHub account if she does not have one.
2. Open https://github.com/aranyab0924/SpeakTeach
3. **Settings → Collaborators → Add people**
4. Invite her GitHub username
5. She accepts the email invite

She should work on a **branch**, not directly on `main`.

Suggested branch name: `feat/auth-supabase`

---

## Part 1 — Install tools

Install these on her computer:

1. **Git** — https://git-scm.com
2. **Node.js 18 or newer** (LTS) — https://nodejs.org
3. **Cursor** — https://cursor.com
4. A GitHub account

Check in Terminal / Command Prompt:

```bash
git --version
node --version
npm --version
```

`node` should print `v18` or higher.

She does **not** need Python unless she wants to run the analyzer herself. Auth can be built and tested without FastAPI running.

---

## Part 2 — Get the code and open it in Cursor

```bash
git clone https://github.com/aranyab0924/SpeakTeach.git
cd SpeakTeach
git checkout -b feat/auth-supabase
```

Then in Cursor: **File → Open Folder** and choose the `SpeakTeach` folder.

Read these files first (or ask Cursor to explain them):

- `docs/HUMAN_TEAM.md` (this file)
- `AGENTS.md`
- `shared/DATABASE.md`
- `shared/API_CONTRACT.md`
- `.env.example`

Install frontend packages:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

You should see the SpeakTeach foundation page. If API health says `error`, that only means FastAPI is not running. That is OK for auth work.

---

## Part 3 — Create a Supabase project

1. Go to https://supabase.com and sign in (GitHub login is fine)
2. **New project**
   - Name: `speakteach` (or similar)
   - Database password: generate a strong one and store it in a password manager
   - Region: closest to you
3. Wait until the project is ready

### Auth settings (important for a hackathon)

1. Left sidebar: **Authentication → Providers**
2. Confirm **Email** is enabled
3. **Authentication → Sign In / Up** (or **URL Configuration**, depending on dashboard version)
4. Set **Site URL** to: `http://localhost:5173`
5. Add redirect URL: `http://localhost:5173/**`
6. For the demo, turn **off Confirm email** so signup works immediately without clicking an email link
   - Look under Authentication settings for "Confirm email" / "Enable email confirmations"
   - If confirmations stay on, signup will appear to "do nothing" until the user clicks the email

You are using **email + password only**. Do not add Google / Apple login unless you have extra time.

---

## Part 4 — Create the database tables

The SQL is already in the repo. You are applying it, not inventing a new schema.

1. In Supabase: **SQL Editor → New query**
2. Open `supabase/migrations/20260815120000_init_sessions.sql` in Cursor
3. Copy the entire file into the SQL editor
4. Run it
5. Confirm it succeeded

Then check **Table Editor**. You should see:

- `sessions`
- `stutter_events`

You should **not** see `profiles` or `exercises`.

If you re-run the file and it errors because policies already exist, that usually means it already applied. Do not keep editing the table shapes. If something is wrong, ask in chat and include the error.

### What the tables mean

`sessions` = one saved practice attempt  
`stutter_events` = the individual repetition / prolongation events from that attempt

When saving, map the API fields like this:

| From `AnalysisResult` | Into Supabase |
| --- | --- |
| current logged-in user id | `sessions.user_id` |
| `exercise_id` | `sessions.exercise_id` |
| `duration_seconds` | `sessions.duration_seconds` |
| `transcript` | `sessions.transcript` |
| `metrics` | `sessions.metrics` (json) |
| `feedback` | `sessions.feedback` (json) |
| each `events[]` item | one `stutter_events` row |
| `events[].start` | `stutter_events.start_seconds` |
| `events[].end` | `stutter_events.end_seconds` |

Do not rename the TypeScript fields. Only the database column names `start_seconds` / `end_seconds` are different, because `end` is an awkward SQL name.

---

## Part 5 — Optional private audio bucket

Do this after login + saving sessions work. Skip it if time is short.

1. Supabase **Storage → New bucket**
2. Name: `recordings`
3. **Private** (not public)
4. Add storage policies so a user can only read/write files under their own folder

Suggested path:

```text
{user_id}/{session_id}.webm
```

Then store that path in `sessions.audio_path`.

Storage upsert needs insert + select + update policies. If replacing a file silently fails, you are probably missing one of those.

---

## Part 6 — Keys (this is the easy place to make a dangerous mistake)

In Supabase: **Project Settings → API** (or **Data API**)

Copy only:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public / publishable** key → `VITE_SUPABASE_ANON_KEY`

Do **not** copy:

- `service_role`
- `secret`
- anything labeled "bypasses Row Level Security"

Create `frontend/.env.local` (this file is gitignored; never commit it):

```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=paste_the_anon_key_here
```

Restart `npm run dev` after changing env files.

If you accidentally pasted the service role key into the frontend, rotate/revoke it in Supabase immediately and start over with the anon key.

---

## Part 7 — What to build in the frontend

Stay inside `frontend/` unless you are only reading docs.

Suggested files (Cursor can create these; names can vary slightly):

```text
frontend/src/lib/supabase.ts          # create the browser client
frontend/src/services/auth.ts         # signUp, signIn, signOut, getUser
frontend/src/services/sessions.ts     # save AnalysisResult, list my sessions
frontend/src/hooks/useAuth.ts         # current user + loading state
frontend/src/pages/LoginPage.tsx
frontend/src/pages/SignupPage.tsx
frontend/src/components/AuthForm.tsx  # if you want a shared form
```

Use `src/styles/theme.css` for styling. Do not add extra CSS files.

Do not call `fetch` / Supabase directly from huge page components. Put those calls in `src/services/`.

### 1. Supabase client

Use `@supabase/supabase-js`.

Create one browser client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

If Cursor suggests `@supabase/ssr` or Next.js cookies, say no. This app is Vite + React, not Next.js.

### 2. Auth screens

Minimum:

- Sign up with email + password
- Log in with email + password
- Log out
- Show a clear error if login fails
- After login, remember the session on refresh (`onAuthStateChange` / `getSession`)

No profile editor. No username table. The user id is `session.user.id`.

### 3. Save a practice result

Write a function like `saveAnalysisResult(result: AnalysisResult, audio?: Blob)`.

It should:

1. Require a logged-in user
2. Insert `sessions` with `user_id: user.id`
3. Insert `stutter_events` for `result.events`
4. Optionally upload audio, then update `audio_path`
5. Return errors instead of failing silently

Until Agent 3 has a results screen, test with `MOCK_ANALYSIS_RESULT` from `frontend/src/data/mockAnalysis.ts`. A temporary "Save mock session" button on the home page is fine for development. Remove it before the demo if it looks confusing.

### 4. Read-back / progress log (nice to have)

A simple "My sessions" list is enough:

- date
- exercise_id
- duration
- total_events from metrics

Do not build a polished dashboard unless the rest is done.

---

## Part 8 — How to test (do this yourself before asking for review)

1. Sign up with a test email
2. Refresh the page — you should still be logged in
3. Log out, then log in
4. Save a mock `AnalysisResult`
5. In Supabase **Table Editor → sessions**, you should see one row with your user id
6. **stutter_events** should have the matching event rows
7. Open an incognito window, sign up a **second** user, and confirm they cannot see the first user's rows
8. If you added storage, confirm the bucket is private (a logged-out request should not download audio)

If step 7 fails, RLS is wrong. Stop and fix that before adding more UI. This data is sensitive.

---

## Part 9 — Cursor prompt she can paste

Open Cursor chat in the SpeakTeach folder, attach `docs/HUMAN_TEAM.md`, and paste:

```text
I am the human auth/persistence teammate for SpeakTeach. Follow docs/HUMAN_TEAM.md.

Build email/password auth and saving AnalysisResult to Supabase from the Vite React frontend only.

Rules:
- Do not modify backend/ except if I explicitly ask
- Do not create profiles or exercises tables
- Do not rename AnalysisResult fields in frontend/src/types/analysis.ts
- Do not use the Supabase service_role key
- Put API/Supabase calls in frontend/src/services/
- Use only frontend/src/styles/theme.css for CSS
- Use the existing schema in shared/DATABASE.md and supabase/migrations/20260815120000_init_sessions.sql

First inspect the repo, then:
1. Add @supabase/supabase-js and a browser client
2. Add signup, login, logout, and a session hook
3. Add saveAnalysisResult() that writes sessions + stutter_events
4. Add a simple way to test saving with frontend/src/data/mockAnalysis.ts
5. Tell me exactly what to put in frontend/.env.local and how to test in the Supabase dashboard
```

Work in small steps. After each step, run the app and test it. Do not ask Cursor to "build the whole product."

---

## Part 10 — Git workflow

```bash
git status
git add frontend/src frontend/package.json frontend/package-lock.json
git commit -m "feat: add Supabase email auth and session saving"
```

Do not add:

- `frontend/.env.local`
- `node_modules`
- audio files
- anything named `service_role`

Then push her branch (she will need permission on the repo):

```bash
git push -u origin feat/auth-supabase
```

Open a pull request into `main` on GitHub. Do not push straight to `main` unless Aranya asks for that.

---

## Common beginner problems

| What you see | Likely cause |
| --- | --- |
| Signup "works" but you are not logged in | Email confirmation is still enabled |
| `Invalid API key` | Wrong key, or extra quotes/spaces in `.env.local` |
| Env vars are `undefined` | Forgot to restart `npm run dev`, or file is not `frontend/.env.local` |
| Insert returns 0 rows / empty data | Not logged in, or RLS policy blocked it |
| `new row violates row-level security` | `user_id` is missing or is not `auth.uid()` |
| Second user can see first user's sessions | RLS is off or policies are too open — fix immediately |
| Cursor wants to edit FastAPI or add Next.js | Remind it this is Vite + React, auth is frontend-only |
| Cursor wants a service role key "for safety" | No. That key is unsafe in the browser |

---

## Done when

- A user can sign up, log in, log out, and stay logged in on refresh
- A logged-in user can save an `AnalysisResult`
- Users cannot read each other's sessions
- No service_role key exists in the frontend
- `.env.local` is not in git
