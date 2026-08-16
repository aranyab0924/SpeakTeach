# SpeakTeach

Practice tool for people who stutter. Users work through speaking
exercises, get event-level feedback, and can optionally save a progress
log. It supplements speech therapy; it does not replace a therapist.

This repository is a hackathon MVP foundation. Recorder UI, real
detection, results UI, and auth are owned by later teams.

## Requirements

- Node 18+
- Python 3.11+

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
should return `{"status":"ok"}`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000`.

Copy `.env.example` values into `frontend/.env.local` when you add
Supabase. Never commit `.env` files or a service-role key.
