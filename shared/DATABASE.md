# SpeakTeach database

FastAPI does not use this database. The authenticated React app writes
directly to Supabase with the publishable (anon) key and the user JWT.
RLS is the security boundary.

Treat recordings, transcripts, and events as sensitive / medical-adjacent
data. Do not put a service-role key in the frontend. This MVP should not
need a service-role key at all.

There is no `profiles` table. `auth.users.id` identifies the user.
There is no `exercises` table. Exercises live in
`frontend/src/data/exercises.ts`.

## Tables

### auth.users

Supabase Auth. Email / password.

### public.sessions

One row per completed (or saved) practice attempt.

| column | type | notes |
| --- | --- | --- |
| id | uuid pk | |
| user_id | uuid | `auth.users.id`, required for RLS |
| exercise_id | text | matches `frontend/src/data/exercises.ts` |
| duration_seconds | float | from AnalysisResult |
| transcript | text | from AnalysisResult |
| metrics | jsonb | AnalysisResult.metrics |
| feedback | jsonb | AnalysisResult.feedback |
| audio_path | text | optional Storage path |
| created_at | timestamptz | |

RLS: `(select auth.uid()) = user_id`

### public.stutter_events

One row per AnalysisResult event.

| column | type | maps from |
| --- | --- | --- |
| id | uuid pk | events[].id may be stored here or regenerated |
| session_id | uuid fk → sessions.id | |
| type | text | `repetition` \| `prolongation` |
| start_seconds | float | events[].start |
| end_seconds | float | events[].end |
| confidence | float | events[].confidence |
| text | text | events[].text |
| created_at | timestamptz | |

`start` / `end` are reserved-ish in SQL, so the table uses
`start_seconds` / `end_seconds`. The API contract is still `start` / `end`.

RLS: the row is reachable only if the owning session has
`(select auth.uid()) = user_id`.

## Optional storage

Private bucket: `recordings`

Path suggestion: `{user_id}/{session_id}.webm`

Downloads require the user JWT. Storage RLS must restrict objects to
the owning user. Do not make this bucket public.

## Mapping

React receives `AnalysisResult` from FastAPI, then (optionally) inserts:

1. one `sessions` row
2. N `stutter_events` rows
3. optionally the audio file into `recordings`

## Apply

Starter SQL: `supabase/migrations/20260815120000_init_sessions.sql`

Human team applies this in the Supabase project. Cursor agents 1–3 do
not implement auth.
