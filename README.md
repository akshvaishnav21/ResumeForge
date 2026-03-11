# ResumeForge

AI-powered resume tailoring. Paste a job description, get a tailored resume in under 2 minutes.

## How it works

ResumeForge runs a 4-step AI pipeline against your master resume and the target job description:

1. **Extract** — parse the JD into structured requirements
2. **Map** — match requirements to your resume's content
3. **Tailor** — rewrite and reorder to maximise ATS score
4. **Validate** — fact-check against your master resume and score ATS fit

Three intensity levels — Light, Moderate, Heavy — control how aggressively content is rewritten.

## Key design decisions

- **Bring-your-own-key** — no API key is stored server-side. You paste your [Gemini API key](https://aistudio.google.com/apikey) in the UI; it lives only in `sessionStorage` for that tab and is never written to the database.
- **Append-only history** — tailored resumes are never deleted, giving full traceability.
- **Export** — download results as PDF, DOCX, Markdown, or plain text.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI + SQLModel + SQLite |
| AI | Gemini 2.0 Flash (primary) · Azure OpenAI (fallback) |
| Deploy | Docker (multi-stage) · Railway |

## Getting started

### Prerequisites
- [Node.js 20+](https://nodejs.org)
- [Python 3.11+](https://python.org)
- A free [Gemini API key](https://aistudio.google.com/apikey)

### Run with Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8000`.

### Run locally (dev mode)

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal)
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api` to the backend.

### Environment variables

Copy `.env.example` to `.env` and fill in as needed:

```bash
# Optional — if set, pre-fills the API key field in local dev
# GEMINI_API_KEY=AIza...

GEMINI_MODEL=gemini-2.0-flash
DATABASE_URL=sqlite+aiosqlite:///./resumeforge.db
ENABLE_VALIDATION=true

# Azure OpenAI fallback (optional)
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

## Deploy to Railway

1. Fork this repo
2. [Create a new Railway project](https://railway.app) → **Deploy from GitHub** → select your fork
3. In **Variables**, set:
   ```
   DATABASE_URL=sqlite+aiosqlite:///./resumeforge.db
   GEMINI_MODEL=gemini-2.0-flash
   ENABLE_VALIDATION=true
   ```
4. Railway auto-detects the root `Dockerfile` and builds the app
5. Open the generated Railway URL — done

No API key needed in Railway variables; each user supplies their own in the UI.

## Project structure

```
backend/
  app/
    main.py              # FastAPI app entry point
    config.py            # Settings (pydantic-settings)
    database.py          # Async SQLite engine
    models/              # SQLModel schemas
    services/
      router.py          # LLM router (Gemini → Azure fallback)
      jd_analyzer.py     # Step 1: JD extraction
      tailoring_engine.py # Steps 2-4: map → tailor → validate
      exporter.py        # PDF / DOCX / MD / TXT export
    routers/             # FastAPI route handlers
    prompts/             # Versioned prompt templates (.txt)
  tests/
frontend/
  src/
    pages/               # Dashboard, Preview, History, ResumeEditor, Settings
    components/          # Navigation, ATSBadge, HistoryCard, ResumePreview, StepProgress
    hooks/               # useApi.js (fetch + key injection), useSSE.js
```

## Running tests

```bash
cd backend
pytest tests/ -v
```
