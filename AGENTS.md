# SpeakTeach Development Rules

SpeakTeach is a hackathon MVP. People who stutter use it to practice
speaking through exercises. Recordings are analyzed and the user gets
specific feedback on detected stuttering events.

This does not replace a speech therapist. It supplements practice and
optionally saves a progress log.

Treat recordings, transcripts, and speech events as sensitive /
medical-adjacent user data.

## Core product flow

Exercise
-> Record
-> POST /api/v1/analyze
-> Detect speech events
-> Generate feedback
-> Show results
-> Optionally save session (Supabase, from the frontend)

## Priorities

1. Working end-to-end demo
2. Reliability
3. Clear interfaces
4. Security
5. UI polish

Do not over-engineer.

Hardcoded exercises, mock analysis results, and mock detectors are
acceptable when needed to keep teams independent.

## Architecture

Frontend: React + TypeScript + Vite
Backend: FastAPI + Python (speech analysis only)
Auth / persistence: Supabase, called from the frontend

Do not create a Node backend.

FastAPI must not authenticate users, must not use a Supabase
service-role key, and must not read or write the database.

The browser uses the Supabase publishable (anon) key plus the user JWT.
RLS is the security boundary.

Never place Supabase secret/service-role credentials in frontend code.

## Shared contracts

Do not modify unless explicitly instructed:

- shared/API_CONTRACT.md
- shared/DATABASE.md
- frontend/src/types/analysis.ts
- backend/app/schemas/analysis.py

Do not rename AnalysisResult fields.

Exercises are hardcoded in frontend/src/data/exercises.ts.
Do not add an exercises database table.

## API

All routes start with /api/v1.

Core endpoint: POST /api/v1/analyze

MVP detector scope: repetition and prolongation only.

## Team ownership

Use at most 3 Cursor agents after this foundation commit, plus the
human auth/data team.

### Agent 1 — Recorder + Exercise UI

Owns: frontend microphone flow and exercise-running UI.

Typical files: AudioRecorder.tsx, useAudioRecorder.ts,
services/audio.ts, exercise page, recording timer, playback,
permission errors, sending the audio Blob to /api/v1/analyze.

Must not touch Supabase or ML.

### Agent 2 — Speech Analysis Backend

Owns: backend/app/ml/, audio preprocessing, audio_service.py,
analysis_service.py, routers/analyze.py.

Start with MockStutterDetector, get the pipeline working, then replace
the mock. Do not change the API shape or the frontend.

### Agent 3 — Results + Feedback

Owns: results screen (timeline, metrics, transcript highlighting,
event cards, feedback card, next-exercise suggestion) and
backend/app/services/feedback_service.py.

Builds against the frozen AnalysisResult contract. May use
frontend/src/data/mockAnalysis.ts until Agent 2 is ready.

Must not change /analyze or the detector.

### Human team — Auth + Persistence

Owns: Supabase email/password auth from React, RLS, saving sessions
and stutter_events, optional private recordings bucket.

No FastAPI auth. No profiles table. auth.users.id identifies the user.

## Agent rules

Only modify files required for your assigned task.

Do not rewrite unrelated files.

Do not change another team's architecture.

Do not add dependencies unless necessary.

Do not rename shared API fields.

Do not change database schemas without explicit instruction.

Never commit secrets, .env files, keys, or recorded user audio.

Always handle errors explicitly.

Test your own feature before finishing.

Do not commit or push unless explicitly instructed.
