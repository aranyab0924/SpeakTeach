# Frontend Rules

Use React and TypeScript.

Reusable UI belongs in:
src/components/

Pages belong in:
src/pages/

API calls belong in:
src/services/

Types belong in:
src/types/

Exercise list belongs in:
src/data/exercises.ts

Do not call fetch directly inside large page components.

Do not create additional CSS files.

Use:
src/styles/theme.css

Use the existing AnalysisResult contract in src/types/analysis.ts.
Do not rename fields.

## Agent 1 — Recorder + Exercise UI

Owns microphone flow, exercise page, timer, playback, permission
errors, and posting the audio Blob to /api/v1/analyze.

Typical files:
- src/components/AudioRecorder.tsx
- src/hooks/useAudioRecorder.ts
- src/services/audio.ts
- src/pages/ (exercise-running UI)

Must not touch Supabase or ML.
Must not modify backend code.

## Agent 3 — Results + Feedback

Owns the results screen: timeline, metrics, transcript highlighting,
event cards, feedback card, next-exercise suggestion.

May use src/data/mockAnalysis.ts until the real /analyze pipeline is
ready.

The only backend file Agent 3 may change is:
backend/app/services/feedback_service.py

Must not change /analyze or the detector.
Must not add an exercises database table.
