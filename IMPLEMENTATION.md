# ResumeForge — Implementation Guide

**Detailed step-by-step implementation plan derived from [PRD v1.0](./PRD.md)**

---

## Table of Contents

- [0. Prerequisites & Environment Setup](#0-prerequisites--environment-setup)
- [1. Project Scaffolding](#1-project-scaffolding)
- [2. Master Resume Schema & Storage](#2-master-resume-schema--storage)
- [3. Database Layer](#3-database-layer)
- [4. Intelligence Layer — Multi-Model Router](#4-intelligence-layer--multi-model-router)
- [5. Prompt Engineering — The Tailoring Chain](#5-prompt-engineering--the-tailoring-chain)
- [6. Backend API — FastAPI Service](#6-backend-api--fastapi-service)
- [7. Frontend — React Web UI](#7-frontend--react-web-ui)
- [8. Export Pipeline (PDF / DOCX)](#8-export-pipeline-pdf--docx)
- [9. History & Tracking System](#9-history--tracking-system)
- [10. Networking — Cloudflare Tunnel for Local LLM](#10-networking--cloudflare-tunnel-for-local-llm)
- [11. Dockerisation](#11-dockerisation)
- [12. Deployment — Azure App Service](#12-deployment--azure-app-service)
- [13. PWA & Mobile Optimisation](#13-pwa--mobile-optimisation)
- [14. Testing Strategy](#14-testing-strategy)
- [15. CI/CD — GitHub Actions](#15-cicd--github-actions)
- [16. Phase-by-Phase Checklist](#16-phase-by-phase-checklist)

---

## 0. Prerequisites & Environment Setup

### 0.1 Required Software

Install these before starting any implementation work.

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Backend runtime |
| Node.js | 20 LTS+ | Frontend build tooling |
| Ollama | Latest | Local LLM serving |
| Docker | 24+ | Containerisation |
| Git | 2.40+ | Version control |
| cloudflared | Latest | Cloudflare Tunnel CLI |

### 0.2 Accounts & API Keys

| Service | What You Need | Where to Get It |
|---|---|---|
| Azure AI Foundry | API key + endpoint URL for GPT 5.2 | https://ai.azure.com → Deployments → your GPT 5.2 model |
| Google AI (optional) | Gemini API key | https://aistudio.google.com/apikey |
| Cloudflare (free) | Account + Tunnel token | https://dash.cloudflare.com → Zero Trust → Tunnels |
| Azure App Service (free tier) | Subscription | https://portal.azure.com |
| GitHub | Repository | https://github.com |

### 0.3 Local LLM Setup

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a recommended model (choose one based on your hardware)
# For ≥32GB RAM / good GPU:
ollama pull llama3.3:70b

# For 16GB RAM / moderate GPU:
ollama pull llama3.3:8b

# For 8GB RAM / CPU-only:
ollama pull mistral:7b

# Verify it's running
curl http://localhost:11434/api/tags
```

Ollama serves an OpenAI-compatible API at `http://localhost:11434/v1` by default. No extra configuration needed.

### 0.4 Environment Variables

Create a `.env` file at the project root. This file is `.gitignore`d and holds all secrets.

```bash
# .env
# ── Local LLM ──
LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=llama3.3:70b

# ── Azure GPT 5.2 ──
AZURE_OPENAI_API_KEY=your-azure-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-52
AZURE_OPENAI_API_VERSION=2025-01-01

# ── Gemini (optional) ──
GEMINI_API_KEY=your-gemini-key-here

# ── App Config ──
APP_SECRET_KEY=generate-a-random-32-char-string
DATABASE_URL=sqlite+aiosqlite:///./resumeforge.db
CLOUDFLARE_TUNNEL_URL=https://your-tunnel.trycloudflare.com
```

---

## 1. Project Scaffolding

### 1.1 Repository Structure

```
resumeforge/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entrypoint
│   │   ├── config.py               # Pydantic settings (reads .env)
│   │   ├── database.py             # SQLModel engine + session setup
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── resume.py           # MasterResume, ResumeVersion models
│   │   │   ├── history.py          # TailoredResume, JDAnalysis models
│   │   │   └── settings.py         # UserSettings model
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── tailor.py           # POST /api/tailor, POST /api/compare
│   │   │   ├── resume.py           # GET/PUT /api/resume, POST /api/resume/import
│   │   │   ├── history.py          # GET /api/history, GET /api/history/{id}, POST /api/history/{id}/retailor
│   │   │   ├── export.py           # GET /api/export/{id}/{format}
│   │   │   ├── models_status.py    # GET /api/models/status
│   │   │   └── cover_letter.py     # POST /api/cover-letter (Phase 2)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── router.py           # Multi-model router (local → Azure → Gemini)
│   │   │   ├── jd_analyzer.py      # JD parsing + keyword extraction
│   │   │   ├── tailoring_engine.py # Prompt chain orchestration
│   │   │   ├── resume_parser.py    # PDF/DOCX → structured JSON import
│   │   │   └── exporter.py         # PDF/DOCX/MD/TXT generation
│   │   └── prompts/
│   │       ├── extraction.txt      # Step 1: JD → structured requirements
│   │       ├── mapping.txt         # Step 2: requirements → resume items
│   │       ├── tailor_light.txt    # Step 3a: light rewrite
│   │       ├── tailor_moderate.txt # Step 3b: moderate rewrite
│   │       ├── tailor_heavy.txt    # Step 3c: heavy rewrite
│   │       ├── validation.txt      # Step 4: factual consistency check
│   │       └── cover_letter.txt    # Cover letter generation (Phase 2)
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_router.py
│   │   ├── test_tailoring.py
│   │   ├── test_jd_analyzer.py
│   │   └── test_api.py
│   ├── alembic/                    # DB migrations (optional, useful for schema changes)
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Home screen — paste JD, tailor
│   │   │   ├── Preview.jsx         # Tailored resume preview + export
│   │   │   ├── History.jsx         # Browse past generations
│   │   │   ├── ResumeEditor.jsx    # Master resume editor
│   │   │   └── Settings.jsx        # Model config, preferences
│   │   ├── components/
│   │   │   ├── JDInput.jsx         # Textarea + model/intensity selectors
│   │   │   ├── ResumePreview.jsx   # Formatted resume display
│   │   │   ├── StreamingText.jsx   # SSE consumer for real-time output
│   │   │   ├── ATSBadge.jsx        # Keyword match score indicator
│   │   │   ├── HistoryCard.jsx     # Single history entry
│   │   │   ├── ModelSelector.jsx   # Dropdown for model choice
│   │   │   └── Navigation.jsx      # Bottom nav bar (mobile-first)
│   │   ├── hooks/
│   │   │   ├── useSSE.js           # SSE connection hook
│   │   │   └── useApi.js           # Fetch wrapper with error handling
│   │   ├── utils/
│   │   │   └── api.js              # API base URL, auth header helpers
│   │   └── styles/
│   │       └── index.css           # Tailwind directives
│   ├── public/
│   │   ├── manifest.json           # PWA manifest
│   │   ├── sw.js                   # Service worker (Workbox-generated)
│   │   └── icons/                  # App icons (192px, 512px)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── prompts/                        # Symlink or copy of backend/app/prompts/ for version control visibility
├── docker-compose.yml              # Full stack: backend + frontend + Ollama
├── Dockerfile                      # Combined or multi-stage build
├── .env                            # Local secrets (gitignored)
├── .env.example                    # Template with placeholder values (committed)
├── .gitignore
├── PRD.md
├── IMPLEMENTATION.md               # This file
└── README.md
```

### 1.2 Initialise Backend

```bash
mkdir -p resumeforge/backend/app/{models,routers,services,prompts}
mkdir -p resumeforge/backend/tests
cd resumeforge/backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install core dependencies
pip install fastapi[standard] uvicorn[standard] sqlmodel aiosqlite \
    openai httpx python-dotenv pydantic-settings weasyprint \
    python-multipart PyPDF2 python-docx jinja2
```

**`requirements.txt`** — pin to exact versions after initial install:

```
fastapi[standard]>=0.115.0
uvicorn[standard]>=0.30.0
sqlmodel>=0.0.22
aiosqlite>=0.20.0
openai>=1.60.0
httpx>=0.27.0
python-dotenv>=1.0.0
pydantic-settings>=2.5.0
weasyprint>=62.0
python-multipart>=0.0.12
PyPDF2>=3.0.0
python-docx>=1.1.0
jinja2>=3.1.0
google-genai>=1.0.0
```

### 1.3 Initialise Frontend

```bash
cd resumeforge/frontend

npm create vite@latest . -- --template react
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom lucide-react
```

**`vite.config.js`:**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',  // Proxy API calls to FastAPI in dev
    },
  },
});
```

**`src/styles/index.css`:**

```css
@import "tailwindcss";
```

---

## 2. Master Resume Schema & Storage

### 2.1 JSON Schema Definition

Create `backend/app/models/resume_schema.json`. This is the contract that all components depend on.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MasterResume",
  "type": "object",
  "required": ["contact", "summary", "experience", "skills"],
  "properties": {
    "contact": {
      "type": "object",
      "required": ["name", "email"],
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "phone": { "type": "string" },
        "linkedin": { "type": "string", "format": "uri" },
        "github": { "type": "string", "format": "uri" },
        "portfolio": { "type": "string", "format": "uri" },
        "location": { "type": "string" }
      }
    },
    "summary": { "type": "string", "maxLength": 2000 },
    "experience": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["company", "title", "start_date", "bullets"],
        "properties": {
          "company": { "type": "string" },
          "title": { "type": "string" },
          "start_date": { "type": "string", "format": "date" },
          "end_date": { "type": ["string", "null"], "format": "date" },
          "location": { "type": "string" },
          "bullets": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "skills": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["category", "items"],
        "properties": {
          "category": { "type": "string" },
          "items": {
            "type": "array",
            "items": { "type": "string" }
          },
          "proficiency_level": {
            "type": "string",
            "enum": ["expert", "proficient", "familiar"]
          }
        }
      }
    },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "description"],
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "technologies": { "type": "array", "items": { "type": "string" } },
          "url": { "type": "string", "format": "uri" },
          "highlights": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "education": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["institution", "degree", "field"],
        "properties": {
          "institution": { "type": "string" },
          "degree": { "type": "string" },
          "field": { "type": "string" },
          "graduation_date": { "type": "string", "format": "date" },
          "gpa": { "type": ["number", "null"] },
          "honours": { "type": "array", "items": { "type": "string" } },
          "coursework": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "certifications": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "issuer"],
        "properties": {
          "name": { "type": "string" },
          "issuer": { "type": "string" },
          "date": { "type": "string", "format": "date" },
          "expiry_date": { "type": ["string", "null"], "format": "date" },
          "credential_id": { "type": "string" }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "target_roles": { "type": "array", "items": { "type": "string" } },
        "industries": { "type": "array", "items": { "type": "string" } },
        "preferences": {
          "type": "object",
          "properties": {
            "default_format": { "type": "string", "enum": ["pdf", "docx", "md"] },
            "default_intensity": { "type": "string", "enum": ["light", "moderate", "heavy"] },
            "max_pages": { "type": "integer", "minimum": 1, "maximum": 3 },
            "tone": { "type": "string", "enum": ["professional", "conversational", "technical"] }
          }
        }
      }
    }
  }
}
```

### 2.2 Pydantic Models (Backend)

**`backend/app/models/resume.py`:**

```python
from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from sqlmodel import SQLModel, Field
import json


# ── Pydantic models for the master resume structure ──

class Contact(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    location: Optional[str] = None


class Experience(BaseModel):
    company: str
    title: str
    start_date: str
    end_date: Optional[str] = None
    location: Optional[str] = None
    bullets: list[str]


class SkillCategory(BaseModel):
    category: str
    items: list[str]
    proficiency_level: Optional[str] = None  # expert | proficient | familiar


class Project(BaseModel):
    name: str
    description: str
    technologies: list[str] = []
    url: Optional[str] = None
    highlights: list[str] = []


class Education(BaseModel):
    institution: str
    degree: str
    field: str
    graduation_date: Optional[str] = None
    gpa: Optional[float] = None
    honours: list[str] = []
    coursework: list[str] = []


class Certification(BaseModel):
    name: str
    issuer: str
    date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None


class ResumePreferences(BaseModel):
    default_format: str = "pdf"
    default_intensity: str = "moderate"
    max_pages: int = 1
    tone: str = "professional"


class ResumeMetadata(BaseModel):
    target_roles: list[str] = []
    industries: list[str] = []
    preferences: ResumePreferences = ResumePreferences()


class MasterResumeData(BaseModel):
    """The full structured master resume — this is what the LLM works with."""
    contact: Contact
    summary: str
    experience: list[Experience]
    skills: list[SkillCategory]
    projects: list[Project] = []
    education: list[Education] = []
    certifications: list[Certification] = []
    metadata: ResumeMetadata = ResumeMetadata()


# ── SQLModel for database persistence ──

class MasterResume(SQLModel, table=True):
    """Stores the current master resume as a JSON blob with version tracking."""
    id: Optional[int] = Field(default=None, primary_key=True)
    data: str  # JSON-serialised MasterResumeData
    version: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_current: bool = True

    def get_data(self) -> MasterResumeData:
        return MasterResumeData.model_validate_json(self.data)

    def set_data(self, resume: MasterResumeData) -> None:
        self.data = resume.model_dump_json()
```

### 2.3 Resume Import Service

**`backend/app/services/resume_parser.py`:**

This service handles the initial onboarding — converting an existing PDF or DOCX resume into the structured JSON format via an LLM call.

```python
import io
from PyPDF2 import PdfReader
from docx import Document as DocxDocument
from app.services.router import ModelRouter


async def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


async def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = DocxDocument(io.BytesIO(file_bytes))
    return "\n".join(para.text for para in doc.paragraphs)


async def parse_resume_to_json(file_bytes: bytes, filename: str, router: ModelRouter) -> dict:
    """
    Extracts text from a PDF/DOCX and uses the LLM to convert it
    into the MasterResumeData JSON schema.
    """
    if filename.lower().endswith(".pdf"):
        raw_text = await extract_text_from_pdf(file_bytes)
    elif filename.lower().endswith(".docx"):
        raw_text = await extract_text_from_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {filename}")

    prompt = f"""Parse the following resume text into a structured JSON object.
The JSON must conform to this exact structure:
{{
  "contact": {{ "name": "", "email": "", "phone": "", "linkedin": "", "github": "", "location": "" }},
  "summary": "",
  "experience": [{{ "company": "", "title": "", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "location": "", "bullets": [""] }}],
  "skills": [{{ "category": "", "items": [""] }}],
  "projects": [{{ "name": "", "description": "", "technologies": [""], "highlights": [""] }}],
  "education": [{{ "institution": "", "degree": "", "field": "", "graduation_date": "YYYY-MM-DD" }}],
  "certifications": [{{ "name": "", "issuer": "", "date": "YYYY-MM-DD" }}],
  "metadata": {{ "target_roles": [], "industries": [] }}
}}

Return ONLY the JSON object. No explanation, no markdown fences.

Resume text:
---
{raw_text}
---"""

    response = await router.generate(prompt, prefer="local")
    # Parse and validate
    import json
    from app.models.resume import MasterResumeData
    parsed = json.loads(response)
    validated = MasterResumeData.model_validate(parsed)
    return validated.model_dump()
```

---

## 3. Database Layer

### 3.1 Database Setup

**`backend/app/database.py`:**

```python
from sqlmodel import SQLModel, create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session():
    async with async_session() as session:
        yield session
```

### 3.2 History Model

**`backend/app/models/history.py`:**

```python
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class TailoredResume(SQLModel, table=True):
    """Each generated resume is a row here."""
    id: Optional[int] = Field(default=None, primary_key=True)
    job_description: str                    # Raw JD text
    jd_analysis: str                        # JSON: extracted requirements, keywords, gap report
    tailored_resume: str                    # The final tailored resume (markdown)
    tailoring_mode: str                     # light | moderate | heavy
    model_used: str                         # local | azure | gemini
    company_name: Optional[str] = None      # Extracted from JD
    role_title: Optional[str] = None        # Extracted from JD
    ats_score: Optional[float] = None       # Keyword match percentage
    master_resume_version: int              # Which version of master resume was used
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JDAnalysis(SQLModel, table=True):
    """Cached JD analyses to avoid re-parsing the same JD."""
    id: Optional[int] = Field(default=None, primary_key=True)
    jd_hash: str = Field(index=True)        # SHA-256 of the JD text
    analysis: str                            # JSON: structured analysis output
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### 3.3 Config Model

**`backend/app/config.py`:**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Local LLM
    LOCAL_LLM_BASE_URL: str = "http://localhost:11434/v1"
    LOCAL_LLM_MODEL: str = "llama3.3:70b"

    # Azure
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-52"
    AZURE_OPENAI_API_VERSION: str = "2025-01-01"

    # Gemini
    GEMINI_API_KEY: str = ""

    # App
    APP_SECRET_KEY: str = "change-me-in-production"
    DATABASE_URL: str = "sqlite+aiosqlite:///./resumeforge.db"
    CLOUDFLARE_TUNNEL_URL: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
```

---

## 4. Intelligence Layer — Multi-Model Router

### 4.1 Router Implementation

**`backend/app/services/router.py`:**

This is the core abstraction. All LLM calls go through this router. It handles health checks, failover, streaming, and response normalisation.

```python
import httpx
from openai import AsyncOpenAI
from app.config import settings


class ModelRouter:
    def __init__(self):
        # Local LLM client (Ollama / LM Studio — OpenAI-compatible)
        self.local_client = AsyncOpenAI(
            base_url=settings.LOCAL_LLM_BASE_URL,
            api_key="not-needed",  # Ollama doesn't require a key
        )
        # Azure GPT 5.2 client
        self.azure_client = AsyncOpenAI(
            base_url=f"{settings.AZURE_OPENAI_ENDPOINT}/openai/deployments/{settings.AZURE_OPENAI_DEPLOYMENT}",
            api_key=settings.AZURE_OPENAI_API_KEY,
            default_headers={"api-key": settings.AZURE_OPENAI_API_KEY},
            default_query={"api-version": settings.AZURE_OPENAI_API_VERSION},
        )

    async def health_check_local(self) -> bool:
        """Check if the local LLM is reachable."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{settings.LOCAL_LLM_BASE_URL.replace('/v1', '')}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def health_check_azure(self) -> bool:
        """Check if Azure endpoint is reachable."""
        try:
            # A lightweight completions call with max_tokens=1
            resp = await self.azure_client.chat.completions.create(
                model=settings.AZURE_OPENAI_DEPLOYMENT,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            return True
        except Exception:
            return False

    async def get_all_status(self) -> dict:
        """Return health status of all models."""
        local_ok = await self.health_check_local()
        azure_ok = await self.health_check_azure()
        return {
            "local": {"available": local_ok, "model": settings.LOCAL_LLM_MODEL},
            "azure": {"available": azure_ok, "model": settings.AZURE_OPENAI_DEPLOYMENT},
            "gemini": {"available": bool(settings.GEMINI_API_KEY), "model": "gemini"},
        }

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        prefer: str = "auto",  # auto | local | azure | gemini
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> str:
        """
        Send a prompt to the best available model.
        prefer="auto" → try local first, fall back to Azure.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Determine which client to use
        if prefer == "local" or prefer == "auto":
            if await self.health_check_local():
                return await self._call_openai(
                    self.local_client, settings.LOCAL_LLM_MODEL,
                    messages, temperature, max_tokens
                )
            elif prefer == "local":
                raise ConnectionError("Local LLM is not reachable")

        if prefer in ("azure", "auto"):
            return await self._call_openai(
                self.azure_client, settings.AZURE_OPENAI_DEPLOYMENT,
                messages, temperature, max_tokens
            )

        if prefer == "gemini":
            return await self._call_gemini(prompt, system_prompt, temperature, max_tokens)

        raise ValueError(f"No model available for prefer={prefer}")

    async def generate_stream(self, prompt: str, system_prompt: str = "", prefer: str = "auto"):
        """Streaming variant — yields chunks as they arrive."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        client = self.local_client
        model = settings.LOCAL_LLM_MODEL

        if prefer == "azure" or (prefer == "auto" and not await self.health_check_local()):
            client = self.azure_client
            model = settings.AZURE_OPENAI_DEPLOYMENT

        stream = await client.chat.completions.create(
            model=model, messages=messages,
            temperature=0.3, max_tokens=4096, stream=True
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def _call_openai(self, client, model, messages, temperature, max_tokens) -> str:
        response = await client.chat.completions.create(
            model=model, messages=messages,
            temperature=temperature, max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    async def _call_gemini(self, prompt, system_prompt, temperature, max_tokens) -> str:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
            config=genai.types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        return response.text
```

### 4.2 Comparison Mode

Add this method to `ModelRouter` for UC-3 (Model Comparison):

```python
import asyncio

async def compare(self, prompt: str, system_prompt: str = "") -> dict:
    """Run the same prompt against two models in parallel, return both."""
    async def run_local():
        return await self.generate(prompt, system_prompt, prefer="local")

    async def run_azure():
        return await self.generate(prompt, system_prompt, prefer="azure")

    local_result, azure_result = await asyncio.gather(
        run_local(), run_azure(), return_exceptions=True
    )
    return {
        "local": str(local_result) if not isinstance(local_result, Exception) else f"Error: {local_result}",
        "azure": str(azure_result) if not isinstance(azure_result, Exception) else f"Error: {azure_result}",
    }
```

---

## 5. Prompt Engineering — The Tailoring Chain

The PRD specifies a 4-step prompt chain (Section 6.3.2). Each prompt is stored as a separate text file in `backend/app/prompts/` for easy iteration.

### 5.1 Step 1 — Extraction Prompt

**`backend/app/prompts/extraction.txt`:**

```
You are a job description analyst. Parse the following job description into a structured JSON analysis.

Extract:
- job_title: The exact role title
- company_name: The hiring company
- required_skills: Array of explicitly required skills/technologies (mark each as "critical" or "important")
- preferred_skills: Array of nice-to-have skills
- years_experience: Required years of experience (integer or range)
- responsibilities: Array of key job responsibilities
- industry_domain: The industry or domain (e.g., "fintech", "healthcare", "e-commerce")
- tech_stack: Specific technologies, frameworks, tools mentioned
- soft_skills: Communication, leadership, or cultural requirements
- cultural_indicators: Clues about company culture (e.g., "fast-paced", "collaborative")

For each skill in required_skills, assign a weight:
- "critical": Appears in job title, first paragraph, or is repeated multiple times
- "important": Mentioned once in requirements section
- "nice_to_have": In preferred/bonus section

Return ONLY a JSON object. No explanation, no markdown fences.

Job Description:
---
{job_description}
---
```

### 5.2 Step 2 — Mapping Prompt

**`backend/app/prompts/mapping.txt`:**

```
You are a resume strategist. Given the job requirements analysis and the master resume, create a relevance mapping.

For each requirement in the JD analysis, find the best matching item(s) in the master resume. Score each match 0-100.

Also identify:
- gaps: Requirements with no match (score < 30) — these need creative reframing or omission
- strengths: Resume items that strongly match (score > 70) — these should be emphasized
- reframable: Resume items that partially match (score 30-70) — these can be reworded to better align

Return ONLY a JSON object with this structure:
{{
  "mappings": [
    {{
      "requirement": "string (from JD)",
      "weight": "critical|important|nice_to_have",
      "best_match": {{ "source": "experience|skills|projects", "index": 0, "text": "..." }},
      "score": 85,
      "reframe_suggestion": "Optional: how to reword for better alignment"
    }}
  ],
  "gaps": ["requirement with no match", ...],
  "top_strengths": ["strongest matching resume items", ...],
  "recommended_section_order": ["experience", "skills", "projects", ...]
}}

JD Analysis:
---
{jd_analysis}
---

Master Resume:
---
{master_resume}
---
```

### 5.3 Step 3 — Tailoring Prompts

Create three variants. Below is the **moderate** version as the primary example.

**`backend/app/prompts/tailor_moderate.txt`:**

```
You are an expert resume writer. Using the mapping analysis and master resume, produce a tailored resume in Markdown format.

TAILORING INTENSITY: MODERATE
- Rewrite bullet points to emphasize achievements relevant to this role
- Reorder sections to put the most relevant content first
- Adjust the professional summary to directly address this role's key requirements
- Inject missing keywords naturally into existing bullet points where truthful
- Adjust the skills section to prioritise relevant skills; demote or omit irrelevant ones
- You MAY remove bullet points that are completely irrelevant, but preserve the overall work history

STRICT RULES:
1. NEVER fabricate experience, projects, skills, or achievements not present in the master resume
2. NEVER change company names, job titles, dates, or education credentials
3. Keep the resume to {max_pages} page(s) maximum
4. Use strong action verbs and quantified achievements where the data exists
5. Mirror the job description's language/terminology where truthful
6. Maintain a {tone} tone throughout

OUTPUT FORMAT: Clean Markdown with these sections in this order:
# [Full Name]
[Contact line: email | phone | linkedin | github | location]

## Professional Summary
[2-3 sentences tailored to this role]

## Experience
### [Job Title] — [Company]
*[Start Date] – [End Date] | [Location]*
- [Bullet 1]
- [Bullet 2]
...

## Skills
[Grouped by category, most relevant first]

## Projects (if relevant)
## Education
## Certifications (if any)

Return ONLY the Markdown resume. No explanation.

Mapping Analysis:
---
{mapping}
---

Master Resume:
---
{master_resume}
---

Job Description Summary:
---
Title: {job_title} at {company_name}
Key Requirements: {top_requirements}
---
```

The **light** variant removes the "Rewrite bullet points" and "remove irrelevant bullets" instructions, limiting changes to reordering and keyword injection. The **heavy** variant adds permission to synthesize new bullet points from raw resume data and restructure aggressively.

### 5.4 Step 4 — Validation Prompt

**`backend/app/prompts/validation.txt`:**

```
You are a resume fact-checker. Compare the tailored resume against the master resume and flag any discrepancies.

Check for:
1. FABRICATIONS: Any experience, skill, project, or achievement in the tailored version that does NOT exist in the master resume
2. EXAGGERATIONS: Metrics or claims that inflate what the master resume states
3. DATE ERRORS: Changed employment dates, graduation dates, or certification dates
4. TITLE CHANGES: Modified job titles or degree names
5. MISSING CRITICAL ITEMS: Important master resume items that were dropped but are relevant

Return a JSON object:
{{
  "is_valid": true|false,
  "issues": [
    {{
      "type": "fabrication|exaggeration|date_error|title_change|missing_item",
      "severity": "high|medium|low",
      "description": "What's wrong",
      "tailored_text": "The problematic text from the tailored resume",
      "master_text": "What the master resume actually says (or null if fabricated)"
    }}
  ],
  "keyword_match_score": 92.5,
  "matched_keywords": ["python", "fastapi", ...],
  "missing_keywords": ["kubernetes", ...]
}}

Tailored Resume:
---
{tailored_resume}
---

Master Resume:
---
{master_resume}
---

JD Required Keywords:
---
{required_keywords}
---
```

### 5.5 Tailoring Engine (Orchestrator)

**`backend/app/services/tailoring_engine.py`:**

```python
import json
from pathlib import Path
from app.services.router import ModelRouter

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text()


class TailoringEngine:
    def __init__(self, router: ModelRouter):
        self.router = router

    async def analyze_jd(self, jd_text: str) -> dict:
        """Step 1: Parse JD into structured requirements."""
        prompt = load_prompt("extraction").replace("{job_description}", jd_text)
        response = await self.router.generate(prompt, temperature=0.1)
        return json.loads(response)

    async def map_requirements(self, jd_analysis: dict, master_resume: dict) -> dict:
        """Step 2: Map JD requirements to master resume items."""
        prompt = load_prompt("mapping").replace(
            "{jd_analysis}", json.dumps(jd_analysis, indent=2)
        ).replace(
            "{master_resume}", json.dumps(master_resume, indent=2)
        )
        response = await self.router.generate(prompt, temperature=0.1)
        return json.loads(response)

    async def tailor(
        self,
        mapping: dict,
        master_resume: dict,
        jd_analysis: dict,
        mode: str = "moderate",
        max_pages: int = 1,
        tone: str = "professional",
    ) -> str:
        """Step 3: Generate the tailored resume."""
        prompt_template = load_prompt(f"tailor_{mode}")
        prompt = prompt_template.replace(
            "{mapping}", json.dumps(mapping, indent=2)
        ).replace(
            "{master_resume}", json.dumps(master_resume, indent=2)
        ).replace("{max_pages}", str(max_pages)
        ).replace("{tone}", tone
        ).replace("{job_title}", jd_analysis.get("job_title", "")
        ).replace("{company_name}", jd_analysis.get("company_name", "")
        ).replace("{top_requirements}", ", ".join(
            [s.get("name", s) if isinstance(s, dict) else s
             for s in jd_analysis.get("required_skills", [])[:10]]
        ))
        response = await self.router.generate(prompt, temperature=0.3)
        return response

    async def validate(
        self, tailored_resume: str, master_resume: dict, required_keywords: list[str]
    ) -> dict:
        """Step 4: Fact-check the tailored resume against the master."""
        prompt = load_prompt("validation").replace(
            "{tailored_resume}", tailored_resume
        ).replace(
            "{master_resume}", json.dumps(master_resume, indent=2)
        ).replace(
            "{required_keywords}", json.dumps(required_keywords)
        )
        response = await self.router.generate(prompt, temperature=0.0, prefer="azure")
        return json.loads(response)

    async def full_pipeline(
        self,
        jd_text: str,
        master_resume: dict,
        mode: str = "moderate",
        max_pages: int = 1,
        tone: str = "professional",
        validate: bool = True,
    ) -> dict:
        """Run the complete 4-step tailoring pipeline."""
        # Step 1
        jd_analysis = await self.analyze_jd(jd_text)

        # Step 2
        mapping = await self.map_requirements(jd_analysis, master_resume)

        # Step 3
        tailored = await self.tailor(mapping, master_resume, jd_analysis, mode, max_pages, tone)

        # Step 4 (optional)
        validation = None
        if validate:
            keywords = [
                s.get("name", s) if isinstance(s, dict) else s
                for s in jd_analysis.get("required_skills", [])
            ]
            validation = await self.validate(tailored, master_resume, keywords)

        return {
            "tailored_resume": tailored,
            "jd_analysis": jd_analysis,
            "mapping": mapping,
            "validation": validation,
            "ats_score": validation.get("keyword_match_score") if validation else None,
        }
```

---

## 6. Backend API — FastAPI Service

### 6.1 App Entrypoint

**`backend/app/main.py`:**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import init_db
from app.routers import tailor, resume, history, export, models_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="ResumeForge", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock this down in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(tailor.router, prefix="/api", tags=["Tailoring"])
app.include_router(resume.router, prefix="/api", tags=["Resume"])
app.include_router(history.router, prefix="/api", tags=["History"])
app.include_router(export.router, prefix="/api", tags=["Export"])
app.include_router(models_status.router, prefix="/api", tags=["Models"])

# In production, serve the frontend build from here
# app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="frontend")
```

### 6.2 Tailor Router (Core Endpoint)

**`backend/app/routers/tailor.py`:**

```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.services.router import ModelRouter
from app.services.tailoring_engine import TailoringEngine
from app.models.history import TailoredResume
import json

router = APIRouter()
model_router = ModelRouter()
engine = TailoringEngine(model_router)


class TailorRequest(BaseModel):
    job_description: str
    mode: str = "moderate"       # light | moderate | heavy
    model: str = "auto"          # auto | local | azure
    max_pages: int = 1
    tone: str = "professional"
    validate: bool = True


class CompareRequest(BaseModel):
    job_description: str
    mode: str = "moderate"


@router.post("/tailor")
async def tailor_resume(req: TailorRequest, session: AsyncSession = Depends(get_session)):
    # Fetch current master resume
    from sqlmodel import select
    from app.models.resume import MasterResume
    stmt = select(MasterResume).where(MasterResume.is_current == True)
    result = await session.execute(stmt)
    master = result.scalar_one_or_none()
    if not master:
        return {"error": "No master resume found. Please create one first."}

    master_data = master.get_data().model_dump()

    # Run the full pipeline
    output = await engine.full_pipeline(
        jd_text=req.job_description,
        master_resume=master_data,
        mode=req.mode,
        max_pages=req.max_pages,
        tone=req.tone,
        validate=req.validate,
    )

    # Save to history
    record = TailoredResume(
        job_description=req.job_description,
        jd_analysis=json.dumps(output["jd_analysis"]),
        tailored_resume=output["tailored_resume"],
        tailoring_mode=req.mode,
        model_used=req.model,
        company_name=output["jd_analysis"].get("company_name"),
        role_title=output["jd_analysis"].get("job_title"),
        ats_score=output.get("ats_score"),
        master_resume_version=master.version,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    return {
        "id": record.id,
        "tailored_resume": output["tailored_resume"],
        "jd_analysis": output["jd_analysis"],
        "validation": output.get("validation"),
        "ats_score": output.get("ats_score"),
    }


@router.post("/tailor/stream")
async def tailor_resume_stream(req: TailorRequest):
    """SSE endpoint for real-time streaming output."""
    # Simplified streaming — streams the tailoring step only
    # Full implementation would stream each pipeline step
    async def event_generator():
        async for chunk in model_router.generate_stream(
            prompt=f"Tailor this resume for: {req.job_description[:500]}...",
            prefer=req.model if req.model != "auto" else "auto",
        ):
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/analyze-jd")
async def analyze_jd(req: TailorRequest):
    """Standalone JD analysis without tailoring."""
    analysis = await engine.analyze_jd(req.job_description)
    return {"analysis": analysis}


@router.post("/compare")
async def compare_models(req: CompareRequest, session: AsyncSession = Depends(get_session)):
    """Run the same JD through two models and return both outputs."""
    from sqlmodel import select
    from app.models.resume import MasterResume
    stmt = select(MasterResume).where(MasterResume.is_current == True)
    result = await session.execute(stmt)
    master = result.scalar_one_or_none()
    if not master:
        return {"error": "No master resume found."}

    master_data = master.get_data().model_dump()
    jd_analysis = await engine.analyze_jd(req.job_description)
    mapping = await engine.map_requirements(jd_analysis, master_data)

    # Run tailoring on both models in parallel
    import asyncio
    async def tailor_with(prefer):
        engine_copy = TailoringEngine(model_router)
        # Override the router's generate to use specific model
        return await engine_copy.tailor(mapping, master_data, jd_analysis, req.mode)

    local_result, azure_result = await asyncio.gather(
        engine.tailor(mapping, master_data, jd_analysis, req.mode),
        engine.tailor(mapping, master_data, jd_analysis, req.mode),
        return_exceptions=True,
    )

    return {
        "jd_analysis": jd_analysis,
        "local": str(local_result),
        "azure": str(azure_result),
    }
```

### 6.3 Resume Router

**`backend/app/routers/resume.py`:**

```python
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.database import get_session
from app.models.resume import MasterResume, MasterResumeData
from app.services.router import ModelRouter
from app.services.resume_parser import parse_resume_to_json

router = APIRouter()


@router.get("/resume")
async def get_resume(session: AsyncSession = Depends(get_session)):
    stmt = select(MasterResume).where(MasterResume.is_current == True)
    result = await session.execute(stmt)
    master = result.scalar_one_or_none()
    if not master:
        return {"error": "No master resume found."}
    return {"version": master.version, "data": master.get_data().model_dump()}


@router.put("/resume")
async def update_resume(data: MasterResumeData, session: AsyncSession = Depends(get_session)):
    # Mark current as not-current
    stmt = select(MasterResume).where(MasterResume.is_current == True)
    result = await session.execute(stmt)
    current = result.scalar_one_or_none()

    new_version = (current.version + 1) if current else 1
    if current:
        current.is_current = False
        session.add(current)

    # Create new version
    new = MasterResume(version=new_version, is_current=True)
    new.set_data(data)
    session.add(new)
    await session.commit()
    return {"version": new_version, "message": "Master resume updated."}


@router.post("/resume/import")
async def import_resume(file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    contents = await file.read()
    model_router = ModelRouter()
    parsed = await parse_resume_to_json(contents, file.filename, model_router)

    resume_data = MasterResumeData.model_validate(parsed)
    new = MasterResume(version=1, is_current=True)
    new.set_data(resume_data)
    session.add(new)
    await session.commit()
    return {"version": 1, "data": parsed, "message": "Resume imported successfully."}
```

### 6.4 History Router

**`backend/app/routers/history.py`:**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.database import get_session
from app.models.history import TailoredResume
from typing import Optional

router = APIRouter()


@router.get("/history")
async def list_history(
    company: Optional[str] = None,
    role: Optional[str] = None,
    model: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(TailoredResume).order_by(TailoredResume.created_at.desc())
    if company:
        stmt = stmt.where(TailoredResume.company_name.ilike(f"%{company}%"))
    if role:
        stmt = stmt.where(TailoredResume.role_title.ilike(f"%{role}%"))
    if model:
        stmt = stmt.where(TailoredResume.model_used == model)
    stmt = stmt.offset(offset).limit(limit)

    result = await session.execute(stmt)
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "company": r.company_name,
            "role": r.role_title,
            "mode": r.tailoring_mode,
            "model": r.model_used,
            "ats_score": r.ats_score,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


@router.get("/history/{id}")
async def get_history_item(id: int, session: AsyncSession = Depends(get_session)):
    stmt = select(TailoredResume).where(TailoredResume.id == id)
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        return {"error": "Not found"}
    return {
        "id": record.id,
        "job_description": record.job_description,
        "jd_analysis": record.jd_analysis,
        "tailored_resume": record.tailored_resume,
        "tailoring_mode": record.tailoring_mode,
        "model_used": record.model_used,
        "company_name": record.company_name,
        "role_title": record.role_title,
        "ats_score": record.ats_score,
        "created_at": record.created_at.isoformat(),
    }
```

### 6.5 Export & Model Status Routers

**`backend/app/routers/export.py`:**

```python
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.database import get_session
from app.models.history import TailoredResume
from app.services.exporter import export_to_pdf, export_to_docx

router = APIRouter()


@router.get("/export/{id}/{format}")
async def export_resume(id: int, format: str, session: AsyncSession = Depends(get_session)):
    stmt = select(TailoredResume).where(TailoredResume.id == id)
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        return {"error": "Not found"}

    markdown = record.tailored_resume

    if format == "md":
        return Response(content=markdown, media_type="text/markdown",
                        headers={"Content-Disposition": f"attachment; filename=resume_{id}.md"})
    elif format == "txt":
        return Response(content=markdown, media_type="text/plain",
                        headers={"Content-Disposition": f"attachment; filename=resume_{id}.txt"})
    elif format == "pdf":
        pdf_bytes = await export_to_pdf(markdown)
        return Response(content=pdf_bytes, media_type="application/pdf",
                        headers={"Content-Disposition": f"attachment; filename=resume_{id}.pdf"})
    elif format == "docx":
        docx_bytes = await export_to_docx(markdown)
        return Response(content=docx_bytes, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        headers={"Content-Disposition": f"attachment; filename=resume_{id}.docx"})
    return {"error": f"Unsupported format: {format}"}
```

**`backend/app/routers/models_status.py`:**

```python
from fastapi import APIRouter
from app.services.router import ModelRouter

router = APIRouter()
model_router = ModelRouter()


@router.get("/models/status")
async def get_model_status():
    return await model_router.get_all_status()
```

---

## 7. Frontend — React Web UI

### 7.1 App Shell & Routing

**`frontend/src/App.jsx`:**

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import Preview from "./pages/Preview";
import History from "./pages/History";
import ResumeEditor from "./pages/ResumeEditor";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 pb-20">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/preview/:id" element={<Preview />} />
          <Route path="/history" element={<History />} />
          <Route path="/resume" element={<ResumeEditor />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <Navigation />
      </div>
    </BrowserRouter>
  );
}
```

### 7.2 Dashboard (Home Screen)

This is the primary interaction point (PRD Section 9.2). The implementation should prioritise speed: paste JD → tap Tailor → see result.

**Key behaviours:**

- Large textarea fills most of the viewport on mobile
- Model selector defaults to "Auto" (shows a small status dot: green = local available, yellow = cloud only)
- Intensity toggle: three segmented buttons (Light / Moderate / Heavy), default Moderate
- "Tailor" button at the bottom, full width, prominent colour
- On submit: navigate to `/preview/{id}` and begin streaming the result

**`frontend/src/pages/Dashboard.jsx` (structure):**

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [jd, setJd] = useState("");
  const [mode, setMode] = useState("moderate");
  const [model, setModel] = useState("auto");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleTailor = async () => {
    setLoading(true);
    const res = await fetch("/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_description: jd, mode, model }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.id) navigate(`/preview/${data.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">ResumeForge</h1>

      <textarea
        className="w-full h-64 border rounded-lg p-4 text-sm resize-none"
        placeholder="Paste the job description here..."
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />

      {/* Intensity toggle */}
      <div className="flex gap-2 mt-4">
        {["light", "moderate", "heavy"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize
              ${mode === m ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Model selector */}
      <select
        className="w-full mt-3 p-2 border rounded-lg text-sm"
        value={model}
        onChange={(e) => setModel(e.target.value)}
      >
        <option value="auto">Auto (local → cloud fallback)</option>
        <option value="local">Local LLM only</option>
        <option value="azure">Azure GPT 5.2</option>
      </select>

      <button
        onClick={handleTailor}
        disabled={!jd.trim() || loading}
        className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg font-semibold
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Tailoring..." : "Tailor Resume"}
      </button>
    </div>
  );
}
```

### 7.3 SSE Hook for Streaming

**`frontend/src/hooks/useSSE.js`:**

```js
import { useState, useEffect, useRef } from "react";

export function useSSE(url, body, enabled = false) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    controllerRef.current = controller;

    const fetchStream = async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setDone(true);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              setText((prev) => prev + (parsed.text || ""));
            } catch {}
          }
        }
      }
    };

    fetchStream().catch(() => {});
    return () => controller.abort();
  }, [enabled]);

  return { text, done };
}
```

### 7.4 Mobile Navigation

**`frontend/src/components/Navigation.jsx`:**

```jsx
import { NavLink } from "react-router-dom";
import { Home, Clock, FileText, Settings } from "lucide-react";

const tabs = [
  { to: "/", icon: Home, label: "Tailor" },
  { to: "/history", icon: Clock, label: "History" },
  { to: "/resume", icon: FileText, label: "Resume" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Navigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 safe-bottom">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? "text-blue-600" : "text-gray-500"}`
          }
        >
          <Icon size={20} />
          <span className="mt-1">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

---

## 8. Export Pipeline (PDF / DOCX)

### 8.1 PDF via WeasyPrint

**`backend/app/services/exporter.py`:**

```python
import io
import markdown
from weasyprint import HTML
from jinja2 import Template

RESUME_CSS = """
@page { size: letter; margin: 0.75in; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #333; line-height: 1.5; }
h1 { font-size: 20pt; margin-bottom: 4pt; color: #1a1a1a; }
h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #2e75b6; padding-bottom: 3pt; margin-top: 14pt; color: #2e75b6; }
h3 { font-size: 11pt; margin-bottom: 2pt; }
ul { padding-left: 18pt; margin: 4pt 0; }
li { margin-bottom: 3pt; }
em { color: #666; }
"""

HTML_TEMPLATE = """
<!DOCTYPE html>
<html><head><style>{{ css }}</style></head>
<body>{{ content }}</body></html>
"""


async def export_to_pdf(markdown_text: str) -> bytes:
    html_content = markdown.markdown(markdown_text, extensions=["extra"])
    template = Template(HTML_TEMPLATE)
    full_html = template.render(css=RESUME_CSS, content=html_content)
    pdf_bytes = HTML(string=full_html).write_pdf()
    return pdf_bytes


async def export_to_docx(markdown_text: str) -> bytes:
    """Convert markdown to DOCX using pypandoc or python-docx."""
    # Simplified approach: convert markdown → HTML → docx via python-docx
    from docx import Document
    from docx.shared import Pt, Inches

    doc = Document()
    # Parse markdown line by line and add to document
    for line in markdown_text.split("\n"):
        line = line.strip()
        if line.startswith("# "):
            doc.add_heading(line[2:], level=0)
        elif line.startswith("## "):
            doc.add_heading(line[3:], level=1)
        elif line.startswith("### "):
            doc.add_heading(line[4:], level=2)
        elif line.startswith("- "):
            doc.add_paragraph(line[2:], style="List Bullet")
        elif line:
            doc.add_paragraph(line)

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
```

### 8.2 Resume Templates (Phase 3)

Store HTML/CSS templates in `backend/app/templates/resume/`. Each template is a Jinja2 HTML file with its own CSS. The exporter renders the markdown into the chosen template before passing to WeasyPrint.

```
backend/app/templates/resume/
├── classic.html      # Clean, traditional layout
├── modern.html       # Two-column, sidebar design
├── minimal.html      # Ultra-clean, lots of whitespace
└── technical.html    # Monospace accents, code-friendly
```

---

## 9. History & Tracking System

Already implemented via the `TailoredResume` SQLModel and the history router (Section 6.4). Additional implementation details:

### 9.1 ATS Score Calculation

Computed during the validation step (Step 4 of the prompt chain). The score is the percentage of critical + important JD keywords found in the tailored resume.

```python
def calculate_ats_score(tailored_text: str, required_keywords: list[str]) -> float:
    tailored_lower = tailored_text.lower()
    matched = [kw for kw in required_keywords if kw.lower() in tailored_lower]
    return round(len(matched) / max(len(required_keywords), 1) * 100, 1)
```

### 9.2 Search by JD Hash (Caching)

Before running a full analysis, hash the JD and check for a cached analysis:

```python
import hashlib

def hash_jd(jd_text: str) -> str:
    normalised = " ".join(jd_text.lower().split())
    return hashlib.sha256(normalised.encode()).hexdigest()
```

---

## 10. Networking — Cloudflare Tunnel for Local LLM

This enables your phone (or any device) to reach your home PC's Ollama instance securely, without opening router ports.

### 10.1 One-Time Setup

```bash
# Install cloudflared
# macOS:
brew install cloudflared
# Linux:
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authenticate (opens browser)
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create resumeforge-llm

# Configure the tunnel
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /home/<you>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: llm.yourdomain.com
    service: http://localhost:11434
  - service: http_status:404
EOF

# Create DNS record
cloudflared tunnel route dns resumeforge-llm llm.yourdomain.com

# Start the tunnel (run as a service for persistence)
cloudflared tunnel run resumeforge-llm
```

### 10.2 Quick Tunnel (No Domain Required)

For testing, use a quick tunnel that generates a temporary URL:

```bash
cloudflared tunnel --url http://localhost:11434
# Outputs: https://random-words.trycloudflare.com
```

Set this URL in your `.env` as `CLOUDFLARE_TUNNEL_URL`.

### 10.3 Backend Integration

Update the router to try the tunnel URL when the local direct connection fails:

```python
async def health_check_local(self) -> bool:
    # Try direct local first
    for url in [settings.LOCAL_LLM_BASE_URL, settings.CLOUDFLARE_TUNNEL_URL + "/v1"]:
        if not url:
            continue
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(url.replace("/v1", "") + "/api/tags")
                if resp.status_code == 200:
                    self._active_local_url = url
                    return True
        except Exception:
            continue
    return False
```

---

## 11. Dockerisation

### 11.1 Backend Dockerfile

**`backend/Dockerfile`:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
    libffi-dev libcairo2 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY alembic/ alembic/ 2>/dev/null || true

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 11.2 Frontend Build

The frontend is built to static files and served by the backend (or a CDN).

```dockerfile
# frontend/Dockerfile (build stage only)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build
# Output: /app/dist/
```

### 11.3 Docker Compose (Full Stack)

**`docker-compose.yml`:**

```yaml
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - ./data:/app/data          # Persistent DB + generated files
      - frontend_dist:/app/static  # Served by FastAPI
    depends_on:
      - frontend

  frontend:
    build: ./frontend
    volumes:
      - frontend_dist:/output
    command: sh -c "cp -r /app/dist/* /output/"

  # Optional: run Ollama in Docker too (GPU passthrough needed)
  # ollama:
  #   image: ollama/ollama
  #   ports:
  #     - "11434:11434"
  #   volumes:
  #     - ollama_data:/root/.ollama
  #   deploy:
  #     resources:
  #       reservations:
  #         devices:
  #           - driver: nvidia
  #             count: all
  #             capabilities: [gpu]

volumes:
  frontend_dist:
  # ollama_data:
```

**Run:**

```bash
docker compose up --build
# App available at http://localhost:8000
```

---

## 12. Deployment — Azure App Service

### 12.1 Deploy via Azure CLI

```bash
# Login
az login

# Create resource group (if not exists)
az group create --name resumeforge-rg --location eastus

# Create App Service plan (free tier)
az appservice plan create \
  --name resumeforge-plan \
  --resource-group resumeforge-rg \
  --sku F1 \
  --is-linux

# Create the web app (Docker-based)
az webapp create \
  --resource-group resumeforge-rg \
  --plan resumeforge-plan \
  --name resumeforge-app \
  --runtime "PYTHON:3.11"

# Set environment variables
az webapp config appsettings set \
  --resource-group resumeforge-rg \
  --name resumeforge-app \
  --settings \
    AZURE_OPENAI_API_KEY="your-key" \
    AZURE_OPENAI_ENDPOINT="your-endpoint" \
    AZURE_OPENAI_DEPLOYMENT="gpt-52" \
    CLOUDFLARE_TUNNEL_URL="https://your-tunnel.trycloudflare.com" \
    DATABASE_URL="sqlite+aiosqlite:///./data/resumeforge.db"

# Deploy from local source
az webapp up \
  --resource-group resumeforge-rg \
  --name resumeforge-app \
  --runtime "PYTHON:3.11"
```

### 12.2 Alternative: Oracle Cloud Free Tier VM

```bash
# After provisioning an ARM VM (A1.Flex, 4 OCPU, 24GB RAM):
ssh ubuntu@<vm-ip>

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone repo and deploy
git clone https://github.com/you/resumeforge.git
cd resumeforge
cp .env.example .env  # Edit with your API keys
docker compose up -d

# Set up Caddy for automatic HTTPS
sudo apt install caddy
# Caddyfile: your-domain.com { reverse_proxy localhost:8000 }
```

---

## 13. PWA & Mobile Optimisation

### 13.1 PWA Manifest

**`frontend/public/manifest.json`:**

```json
{
  "name": "ResumeForge",
  "short_name": "ResumeForge",
  "description": "AI-powered resume tailoring",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 13.2 Service Worker (Workbox)

Install Workbox Vite plugin:

```bash
npm install -D vite-plugin-pwa
```

**Update `vite.config.js`:**

```js
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/history/,
            handler: "NetworkFirst",
            options: { cacheName: "history-cache", expiration: { maxEntries: 50 } },
          },
        ],
      },
    }),
  ],
});
```

### 13.3 Mobile CSS Considerations

- Use `safe-area-inset-bottom` for iPhone notch/home bar: `pb-[env(safe-area-inset-bottom)]`
- Textarea should use `text-base` (16px) to prevent iOS zoom on focus
- Touch targets minimum 44×44px (Apple HIG)
- Use `overscroll-behavior: contain` on scrollable areas

---

## 14. Testing Strategy

### 14.1 Backend Tests

```bash
pip install pytest pytest-asyncio httpx
```

**`backend/tests/test_api.py`:**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_models_status():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/models/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "local" in data
        assert "azure" in data


@pytest.mark.asyncio
async def test_resume_crud():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create
        resume_data = {
            "contact": {"name": "Test User", "email": "test@example.com"},
            "summary": "Test summary",
            "experience": [],
            "skills": [{"category": "Languages", "items": ["Python"]}],
        }
        resp = await client.put("/api/resume", json=resume_data)
        assert resp.status_code == 200

        # Read
        resp = await client.get("/api/resume")
        assert resp.status_code == 200
        assert resp.json()["data"]["contact"]["name"] == "Test User"
```

### 14.2 Prompt Quality Tests

Create a small benchmark suite with known JD/resume pairs and expected outputs. Run periodically when changing prompts.

```
backend/tests/fixtures/
├── jd_software_engineer.txt
├── jd_product_manager.txt
├── master_resume_sample.json
├── expected_analysis_swe.json      # Known-good JD analysis output
└── expected_keywords_swe.json      # Keywords that must appear in tailored output
```

### 14.3 Frontend Tests

```bash
npm install -D vitest @testing-library/react jsdom
```

Test the critical path: JD input → API call → navigation to preview.

---

## 15. CI/CD — GitHub Actions

**`.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio httpx
          pytest tests/ -v

  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: |
          cd frontend
          npm ci
          npm run build

  deploy:
    needs: [backend-test, frontend-build]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/webapps-deploy@v3
        with:
          app-name: resumeforge-app
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: ./backend
```

---

## 16. Phase-by-Phase Checklist

### Phase 1 — MVP (Weeks 1–3)

- [ ] **Week 1: Foundation**
  - [ ] Scaffold project structure (Section 1)
  - [ ] Define master resume JSON schema (Section 2.1)
  - [ ] Implement Pydantic models (Section 2.2)
  - [ ] Set up SQLite database + models (Section 3)
  - [ ] Build config system with `.env` loading (Section 3.3)
  - [ ] Implement ModelRouter with local LLM support only (Section 4.1, local path)
  - [ ] Install Ollama and pull a model (Section 0.3)

- [ ] **Week 2: Intelligence Layer**
  - [ ] Write extraction prompt + test with sample JDs (Section 5.1)
  - [ ] Write mapping prompt + test (Section 5.2)
  - [ ] Write moderate tailoring prompt + test (Section 5.3)
  - [ ] Build TailoringEngine orchestrator (Section 5.5)
  - [ ] Build resume import service (PDF/DOCX → JSON) (Section 2.3)
  - [ ] Implement `/api/tailor` endpoint (Section 6.2)
  - [ ] Implement `/api/resume` CRUD endpoints (Section 6.3)

- [ ] **Week 3: UI + Export**
  - [ ] Build Dashboard page — JD input + tailor button (Section 7.2)
  - [ ] Build Preview page — display tailored resume (Section 7.1)
  - [ ] Build mobile navigation (Section 7.4)
  - [ ] Implement PDF export via WeasyPrint (Section 8.1)
  - [ ] Implement history list + detail endpoints (Section 6.4)
  - [ ] Build History page (Section 7.1)
  - [ ] Create Dockerfile and test local Docker deployment (Section 11)
  - [ ] **Milestone: End-to-end flow works locally in browser**

### Phase 2 — Multi-Model & Mobile (Weeks 4–6)

- [ ] **Week 4: Cloud Models**
  - [ ] Add Azure GPT 5.2 to ModelRouter (Section 4.1, azure path)
  - [ ] Add Gemini to ModelRouter (Section 4.1, gemini path)
  - [ ] Implement auto-failover logic (local → Azure)
  - [ ] Implement `/api/models/status` endpoint (Section 6.5)
  - [ ] Add model selector to Dashboard UI (Section 7.2)
  - [ ] Write validation prompt (Section 5.4)
  - [ ] Implement comparison endpoint + UI (Section 4.2)

- [ ] **Week 5: Networking + Deployment**
  - [ ] Set up Cloudflare Tunnel on home PC (Section 10.1)
  - [ ] Update ModelRouter to try tunnel URL (Section 10.3)
  - [ ] Deploy backend to Azure App Service (Section 12.1)
  - [ ] Serve frontend build from backend or CDN
  - [ ] Test full flow from phone browser
  - [ ] **Milestone: Works from phone, anywhere**

- [ ] **Week 6: Streaming + PWA**
  - [ ] Implement SSE streaming endpoint (Section 6.2, `/tailor/stream`)
  - [ ] Build useSSE hook (Section 7.3)
  - [ ] Wire streaming into Preview page
  - [ ] Add PWA manifest + service worker (Section 13)
  - [ ] Test installability on Android and iOS
  - [ ] Set up GitHub Actions CI (Section 15)

### Phase 3 — Polish & Extras (Weeks 7–8)

- [ ] Write light and heavy tailoring prompts (Section 5.3 variants)
- [ ] Build cover letter prompt + endpoint (PRD Section 6.6)
- [ ] Add resume template system (Section 8.2)
- [ ] Implement ATS score display in UI (Section 9.1)
- [ ] Build Master Resume Editor page with form + JSON views
- [ ] Add batch tailoring endpoint (accept array of JDs)
- [ ] Implement resume version history with rollback
- [ ] Build inline post-generation editing in Preview page
- [ ] Add history analytics (basic stats dashboard)
- [ ] Write comprehensive test suite (Section 14)

### Phase 4 — Backlog

- [ ] Browser extension for JD extraction
- [ ] Email-to-tailor integration
- [ ] LinkedIn profile import
- [ ] Interview prep question generator
- [ ] Application status tracker (Kanban)

---

## Quick Start (After Setup)

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 3: Start frontend dev server
cd frontend && npm run dev

# Open: http://localhost:5173
```
