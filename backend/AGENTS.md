# Backend Rules

Use FastAPI and Python.

Routers:
app/routers/

Business logic:
app/services/

ML:
app/ml/

Schemas:
app/schemas/

Routers must stay thin.

Do not implement ML directly inside API routes.

ML must not know about React or Supabase.

The speech-analysis backend must function without database access.

Do not add Supabase client libraries or service-role keys here.

Use the existing AnalysisResult schema in app/schemas/analysis.py.
Do not rename fields.

Do not modify frontend code unless explicitly instructed.

## Agent 2 — Speech Analysis Backend

Owns:
- app/ml/
- app/services/audio_service.py
- app/services/analysis_service.py
- app/routers/analyze.py

Start with MockStutterDetector, get the full pipeline working, then
replace the mock. MVP detection: repetition and prolongation only.

Must not change the API contract or frontend types.

Must not modify app/services/feedback_service.py (Agent 3 owns that).

## Agent 3 — Feedback only (in this folder)

Owns:
- app/services/feedback_service.py

Must not change /analyze or the detector.
