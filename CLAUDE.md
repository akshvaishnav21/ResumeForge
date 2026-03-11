# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ResumeForge is an AI-powered resume tailoring system that customizes a master resume to individual job descriptions. It's a mobile-friendly web application with multi-model LLM support (local Ollama primary, Azure GPT fallback).

**Current Status**: Design/specification phase - see PRD.md, DESIGN.md, and IMPLEMENTATION.md for detailed specifications.

## Architecture

### Three-Layer System
- **Frontend**: React 18 + Vite + Tailwind CSS (mobile-first PWA)
- **Backend**: FastAPI (Python 3.11+) + SQLite via SQLModel
- **Intelligence**: Multi-model router (Ollama local → Azure GPT fallback → optional Gemini validation)

### Core Tailoring Pipeline (4-Step Prompt Chain)
1. **Extraction** (~15s): Parse JD → structured requirements JSON
2. **Mapping** (~15s): Match requirements to master resume items
3. **Tailoring** (~30-45s): Generate tailored resume (Light/Moderate/Heavy intensity)
4. **Validation** (~15s): Fact-check against master, cross-model validation

All LLM calls flow through `ModelRouter` for abstraction and failover.

## Development Commands

### Backend
```bash
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
pytest tests/ -v
```

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run build
npm run test
```

### Local LLM
```bash
ollama serve  # Start Ollama server on localhost:11434
```

### Docker
```bash
docker compose up --build  # App at http://localhost:8000
```

## Key API Endpoints

- `POST /api/tailor` - Full 4-step tailoring chain
- `POST /api/tailor/stream` - SSE streaming variant
- `GET/PUT /api/resume` - Master resume CRUD
- `GET /api/history` - List generated resumes
- `GET /api/export/{id}/{format}` - Download as PDF/DOCX/MD/TXT
- `GET /api/models/status` - Health check all models

## Project Structure (When Implemented)

```
backend/
├── app/
│   ├── main.py           # FastAPI app entry
│   ├── prompts/          # Versioned prompt templates
│   │   ├── extraction.txt
│   │   ├── mapping.txt
│   │   ├── tailor_*.txt  # Light/Moderate/Heavy variants
│   │   └── validation.txt
│   ├── services/         # Business logic (ModelRouter, TailoringService)
│   └── models/           # SQLModel schemas
└── tests/

frontend/
├── src/
│   ├── components/       # React components
│   ├── hooks/            # useSSE, useApi
│   └── pages/            # Dashboard, Preview, History, ResumeEditor, Settings
└── public/
```

## Environment Variables

```bash
LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=llama3.3:70b
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT=gpt-52
GEMINI_API_KEY=...
DATABASE_URL=sqlite+aiosqlite:///./resumeforge.db
```

## Design Constraints

- **Local-first**: Default to free Ollama inference; cloud is fallback only
- **Mobile UX**: Critical path (paste JD → tailor → export) must be 3 taps max
- **Append-only history**: Never delete tailored resumes for full traceability
- **Prompts in files**: Keep prompts in versioned .txt files, not hardcoded
- **Temperature settings**: Extraction (0.1), Tailoring (0.3), Validation (0.0)
