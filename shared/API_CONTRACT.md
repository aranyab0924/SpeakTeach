# SpeakTeach API Contract

Do not rename these fields. Frontend TypeScript types and backend
Pydantic schemas must match this document.

FastAPI is speech analysis only. It does not authenticate users and
does not read or write Supabase.

## GET /api/v1/health

Response:

```json
{ "status": "ok" }
```

## POST /api/v1/analyze

Multipart form:

- `file`: audio blob from the browser recorder (`audio/webm`, `video/webm`, or similar)
- `exercise_id`: string matching an id in `frontend/src/data/exercises.ts`

Response: `AnalysisResult`

```json
{
  "analysis_id": "uuid",
  "exercise_id": "ex-reading-1",
  "duration_seconds": 8.4,
  "transcript": "The morning light moved across the quiet lake.",
  "metrics": {
    "total_events": 2,
    "repetitions": 1,
    "prolongations": 1,
    "speech_rate": 110,
    "pause_ratio": 0.18
  },
  "events": [
    {
      "id": "evt-1",
      "type": "repetition",
      "start": 1.2,
      "end": 1.6,
      "confidence": 0.86,
      "text": "m-morning"
    }
  ],
  "patterns": [],
  "feedback": {
    "summary": "string",
    "strengths": ["string"],
    "observations": ["string"],
    "next_step": "string"
  }
}
```

### Field notes

- All JSON keys are snake_case.
- `events[].type` is `repetition` or `prolongation` only for the MVP.
- `events[].start` and `events[].end` are seconds from the start of the recording.
- `patterns` is reserved. Return `[]` until a later contract change.
- `speech_rate` is words per minute. `pause_ratio` is 0–1.
- Errors use FastAPI's default `{ "detail": ... }` shape.

## Pipeline

User records audio
→ POST /api/v1/analyze
→ audio preprocessing
→ StutterDetector
→ structured speech events
→ feedback generator
→ AnalysisResult
→ frontend

The detector is behind `StutterDetector`. Replacing the mock must not
change this contract.
