# ResumeForge — Technical Design Document

**System design and architecture specification**
**Derived from [PRD v1.0](./PRD.md) and [Implementation Guide](./IMPLEMENTATION.md)**

| Field | Value |
|---|---|
| Version | 1.0 |
| Author | AV |
| Status | Draft |
| Created | March 9, 2026 |

---

## Table of Contents

- [1. Design Overview](#1-design-overview)
- [2. System Architecture](#2-system-architecture)
- [3. Data Model](#3-data-model)
- [4. Component Design](#4-component-design)
- [5. API Contract](#5-api-contract)
- [6. Intelligence Layer Design](#6-intelligence-layer-design)
- [7. Data Flow & Sequence Diagrams](#7-data-flow--sequence-diagrams)
- [8. Frontend Architecture](#8-frontend-architecture)
- [9. Networking & Connectivity Design](#9-networking--connectivity-design)
- [10. Security Design](#10-security-design)
- [11. Error Handling & Resilience](#11-error-handling--resilience)
- [12. State Management](#12-state-management)
- [13. Export & Rendering Pipeline](#13-export--rendering-pipeline)
- [14. Deployment Architecture](#14-deployment-architecture)
- [15. Performance Budget](#15-performance-budget)
- [16. Design Decisions Log](#16-design-decisions-log)

---

## 1. Design Overview

### 1.1 System Purpose

ResumeForge transforms a manual 30-minute resume tailoring task into a 2-minute automated pipeline. It accepts a job description, analyses it against a structured master resume, and produces a tailored resume optimised for both human readers and ATS systems.

### 1.2 Design Principles

The following principles guide every design decision in the system:

**Local-first.** The system defaults to running inference on the user's own hardware. Cloud models are a fallback, not the primary path. This minimises cost, maximises privacy, and ensures the system works even without internet access to LLM providers.

**Structured data over raw text.** The master resume is stored as typed JSON, not a blob of text. Every downstream component — prompts, export templates, the editor UI — benefits from knowing the exact shape of the data. This is the single most impactful design decision in the system.

**Prompt chain over monolithic prompt.** The tailoring pipeline is decomposed into four discrete steps (extract → map → tailor → validate), each with its own prompt, its own input/output contract, and its own failure mode. This makes the system debuggable, testable, and iteratively improvable at each stage.

**Mobile-first, desktop-enhanced.** The UI is designed for a 375px viewport first. Desktop layout is a progressive enhancement, not the baseline. The critical path (paste JD → tap Tailor → export PDF) requires exactly 3 interactions.

**Append-only history.** Every generated resume, its source JD, the analysis, and the model used are persisted. Nothing is overwritten. This provides full traceability and enables re-tailoring against an updated master resume.

### 1.3 Document Scope

This document covers the technical design of all components across all four phases defined in the PRD. Phase annotations (P1, P2, P3, P4) indicate when each component is introduced.

---

## 2. System Architecture

### 2.1 Layered Architecture

The system is organised into three layers with strict dependency direction: Presentation → Application → Intelligence. No layer reaches backwards.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                            │
│                                                                      │
│  React SPA (Vite + Tailwind)          PWA Shell (Workbox)            │
│  ┌──────────┐ ┌──────────┐ ┌──────┐  ┌──────────────────┐           │
│  │Dashboard │ │ Preview  │ │Histor│  │ Service Worker   │           │
│  │  Page    │ │  Page    │ │  y   │  │ (offline cache)  │           │
│  └────┬─────┘ └────┬─────┘ └──┬───┘  └──────────────────┘           │
│       │             │          │                                      │
│       └─────────────┼──────────┘                                     │
│                     │  HTTP / SSE                                     │
├─────────────────────┼────────────────────────────────────────────────┤
│                     ▼                                                │
│                        APPLICATION LAYER                             │
│                                                                      │
│  FastAPI (async Python 3.11+)                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│  │ Tailor       │ │ Resume       │ │ History      │                  │
│  │ Router       │ │ Router       │ │ Router       │                  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                  │
│         │                │                │                          │
│  ┌──────▼────────────────▼────────────────▼───────┐                  │
│  │            Service Layer                        │                  │
│  │  ┌──────────────┐  ┌──────────┐  ┌──────────┐  │                  │
│  │  │  Tailoring   │  │ Resume   │  │ Exporter │  │                  │
│  │  │  Engine      │  │ Parser   │  │ (PDF/    │  │                  │
│  │  │  (4-step     │  │ (import) │  │  DOCX)   │  │                  │
│  │  │   chain)     │  │          │  │          │  │                  │
│  │  └──────┬───────┘  └──────────┘  └──────────┘  │                  │
│  │         │                                       │                  │
│  └─────────┼───────────────────────────────────────┘                  │
│            │                                                         │
│  ┌─────────▼─────────┐  ┌─────────────────────┐                      │
│  │   SQLite (async)  │  │   Prompt Templates   │                     │
│  │   via SQLModel    │  │   (versioned files)  │                     │
│  └───────────────────┘  └─────────────────────┘                      │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                        INTELLIGENCE LAYER                            │
│                                                                      │
│  ┌─────────────────────────────────────────────────────┐             │
│  │                  Model Router                        │             │
│  │                                                     │             │
│  │   health_check() → select_model() → generate()     │             │
│  │                                                     │             │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐      │             │
│  │   │  Local   │     │  Azure  │     │ Gemini  │      │             │
│  │   │  LLM     │◄───▶│ GPT5.2  │◄───▶│  API    │      │             │
│  │   │ (Ollama) │     │         │     │         │      │             │
│  │   └─────────┘     └─────────┘     └─────────┘      │             │
│  │    Priority: 1      Priority: 2     Priority: 3     │             │
│  └─────────────────────────────────────────────────────┘             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Inventory

| Component | Layer | Technology | Introduced |
|---|---|---|---|
| Web UI (SPA) | Presentation | React 18 + Vite + Tailwind CSS | P1 |
| PWA Shell | Presentation | Workbox (vite-plugin-pwa) | P2 |
| FastAPI App | Application | Python 3.11+ / FastAPI / Uvicorn | P1 |
| Tailoring Engine | Application | Python (orchestrates prompt chain) | P1 |
| Resume Parser | Application | PyPDF2 + python-docx + LLM | P1 |
| Exporter | Application | WeasyPrint (PDF) + python-docx (DOCX) | P1 |
| SQLite Database | Application | SQLModel + aiosqlite | P1 |
| Model Router | Intelligence | OpenAI SDK (async) + httpx | P1 (local), P2 (multi) |
| Prompt Templates | Intelligence | Plain text files with placeholders | P1 |

---

## 3. Data Model

### 3.1 Entity Relationship Diagram

```
┌─────────────────────┐
│    MasterResume      │
├─────────────────────┤       ┌─────────────────────┐
│ id: PK              │       │   TailoredResume     │
│ data: JSON blob     │       ├─────────────────────┤
│ version: int        │◄──────│ master_resume_version│
│ is_current: bool    │       │ id: PK               │
│ created_at: datetime│       │ job_description: text │
└─────────────────────┘       │ jd_analysis: JSON     │
                              │ tailored_resume: text  │
┌─────────────────────┐       │ tailoring_mode: enum   │
│    JDAnalysis        │       │ model_used: enum       │
├─────────────────────┤       │ company_name: str?     │
│ id: PK              │       │ role_title: str?       │
│ jd_hash: str (idx)  │       │ ats_score: float?      │
│ analysis: JSON      │       │ created_at: datetime   │
│ created_at: datetime│       └─────────────────────┘
└─────────────────────┘
```

### 3.2 MasterResume — JSON Structure

The `data` column in `MasterResume` stores a JSON blob conforming to this schema. This is the contract between all components.

```
MasterResumeData
├── contact: Contact
│   ├── name: string (required)
│   ├── email: string (required)
│   ├── phone: string?
│   ├── linkedin: string?
│   ├── github: string?
│   ├── portfolio: string?
│   └── location: string?
├── summary: string (required, max 2000 chars)
├── experience[]: Experience (required, min 0)
│   ├── company: string (required)
│   ├── title: string (required)
│   ├── start_date: date-string (required)
│   ├── end_date: date-string?
│   ├── location: string?
│   └── bullets[]: string (required)
├── skills[]: SkillCategory (required, min 1)
│   ├── category: string (required)
│   ├── items[]: string (required)
│   └── proficiency_level: enum(expert|proficient|familiar)?
├── projects[]: Project
│   ├── name: string (required)
│   ├── description: string (required)
│   ├── technologies[]: string
│   ├── url: string?
│   └── highlights[]: string
├── education[]: Education
│   ├── institution: string (required)
│   ├── degree: string (required)
│   ├── field: string (required)
│   ├── graduation_date: date-string?
│   ├── gpa: float?
│   ├── honours[]: string
│   └── coursework[]: string
├── certifications[]: Certification
│   ├── name: string (required)
│   ├── issuer: string (required)
│   ├── date: date-string?
│   ├── expiry_date: date-string?
│   └── credential_id: string?
└── metadata: ResumeMetadata
    ├── target_roles[]: string
    ├── industries[]: string
    └── preferences: ResumePreferences
        ├── default_format: enum(pdf|docx|md) = "pdf"
        ├── default_intensity: enum(light|moderate|heavy) = "moderate"
        ├── max_pages: int(1..3) = 1
        └── tone: enum(professional|conversational|technical) = "professional"
```

### 3.3 Versioning Strategy

The `MasterResume` table uses an **append-only versioning model**. Every edit creates a new row with an incremented `version` number. Only one row has `is_current = true` at any time. This enables rollback without data loss.

```
Write path:   UPDATE SET is_current=false WHERE is_current=true
              INSERT (data=new_data, version=old+1, is_current=true)

Read path:    SELECT WHERE is_current=true

Rollback:     UPDATE SET is_current=false WHERE is_current=true
              UPDATE SET is_current=true WHERE version=target_version

History:      SELECT * ORDER BY version DESC
```

### 3.4 JD Analysis Cache

Job descriptions are hashed (SHA-256, after whitespace normalisation) and cached in the `JDAnalysis` table. Before running the extraction prompt, the engine checks for a cache hit. This avoids re-processing the same JD when re-tailoring with different settings.

```
Cache key:    SHA-256(lowercase(collapse_whitespace(jd_text)))
Cache policy: Indefinite (JDs don't change)
Invalidation: Manual only (user can clear cache from Settings)
```

---

## 4. Component Design

### 4.1 Model Router

The Model Router is the central abstraction for all LLM access. It exposes two methods — `generate()` (blocking) and `generate_stream()` (SSE) — and internally manages model selection, health checking, and failover.

**Interface:**

```
ModelRouter
├── generate(prompt, system_prompt?, prefer?, temperature?, max_tokens?) → string
├── generate_stream(prompt, system_prompt?, prefer?) → AsyncIterator[string]
├── compare(prompt, system_prompt?) → {local: string, azure: string}
├── health_check_local() → bool
├── health_check_azure() → bool
└── get_all_status() → {local: Status, azure: Status, gemini: Status}
```

**Model Selection Logic:**

```
                    ┌──────────────┐
                    │  prefer=?    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         prefer=local  prefer=auto  prefer=azure
              │            │            │
              ▼            ▼            │
        ┌──────────┐  ┌──────────┐     │
        │ Local    │  │ Local    │     │
        │ healthy? │  │ healthy? │     │
        └────┬─────┘  └────┬─────┘     │
          Y/ \N         Y/ \N          │
          /   \         /   \          │
         ▼     ▼       ▼     ▼         ▼
       Local  Error  Local  Azure    Azure
```

**Health Check Design:**

Health checks use a 3-second timeout. The local check hits Ollama's `/api/tags` endpoint (lightweight metadata call, no inference). The Azure check is performed lazily — the system assumes Azure is available if the API key is configured, and only marks it as down after a failed request.

The router maintains an internal `_active_local_url` field that tracks whether the local LLM was last reached via the direct URL (`localhost:11434`) or the Cloudflare Tunnel URL. This avoids redundant health checks on subsequent calls.

```
Health check cascade:
1. Try LOCAL_LLM_BASE_URL (direct, e.g., localhost:11434)
2. If failed, try CLOUDFLARE_TUNNEL_URL (remote, e.g., https://llm.yourdomain.com)
3. If both failed, mark local as unavailable
4. Cache result for 30 seconds before re-checking
```

### 4.2 Tailoring Engine

The Tailoring Engine orchestrates the 4-step prompt chain. It is a stateless service — all state is passed in and returned explicitly.

**Interface:**

```
TailoringEngine
├── analyze_jd(jd_text) → JDAnalysis
├── map_requirements(jd_analysis, master_resume) → Mapping
├── tailor(mapping, master_resume, jd_analysis, mode, max_pages, tone) → string
├── validate(tailored_resume, master_resume, required_keywords) → ValidationResult
└── full_pipeline(jd_text, master_resume, mode, ...) → PipelineOutput
```

**Pipeline Execution Model:**

Steps 1 and 2 are inherently sequential (step 2 depends on step 1's output). Step 3 depends on step 2. Step 4 (validation) is independent of step 3's intermediate state and runs as a separate call.

```
Sequential execution:

  [1. Extract JD]  ──▶  [2. Map to Resume]  ──▶  [3. Tailor]  ──▶  [4. Validate]
       ~15s                   ~15s                  ~30s               ~15s
                                                                    (optional,
                                                                     parallel-safe)

Total wall time: 45–75 seconds (local LLM), 20–40 seconds (cloud)
```

For the streaming path (`/api/tailor/stream`), steps 1–2 run synchronously, then step 3 streams token-by-token to the client via SSE. Step 4 runs asynchronously after step 3 completes and the result is pushed as a final SSE event.

### 4.3 Resume Parser

Converts uploaded PDF/DOCX files into the `MasterResumeData` JSON schema. This is a two-phase process:

```
Phase 1: Text Extraction (deterministic)
  PDF  → PyPDF2.PdfReader → concatenated page text
  DOCX → python-docx.Document → concatenated paragraph text

Phase 2: Structured Parsing (LLM-powered)
  Raw text → Extraction prompt → JSON conforming to MasterResumeData schema
  → Pydantic validation → Store in database
```

The LLM is given the exact target JSON schema in the prompt. The response is parsed with `json.loads()` and validated through the `MasterResumeData` Pydantic model. If validation fails, the error message is fed back to the LLM for a retry (max 2 retries).

### 4.4 Exporter

Converts a tailored resume (markdown string) into the requested output format.

```
                     ┌──────────────────┐
                     │  Markdown string  │
                     └────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌─────────┐    ┌─────────┐    ┌──────────┐
         │   PDF   │    │  DOCX   │    │  MD/TXT  │
         └────┬────┘    └────┬────┘    └────┬─────┘
              │              │              │
     markdown → HTML    markdown → doc   passthrough
     → Jinja template   python-docx      (raw bytes)
     → WeasyPrint       line-by-line
     → PDF bytes        → DOCX bytes
```

**PDF Template Pipeline (Phase 3):**

Templates are Jinja2 HTML files with embedded CSS. The markdown is converted to HTML, injected into the template, and rendered by WeasyPrint. Each template defines its own typography, layout, and colour scheme.

```
templates/resume/
├── classic.html      →  Single-column, serif fonts, traditional
├── modern.html       →  Two-column sidebar, sans-serif, colour accents
├── minimal.html      →  Maximum whitespace, monochrome
└── technical.html    →  Monospace accents, code-friendly, skill badges
```

---

## 5. API Contract

### 5.1 Endpoint Summary

All endpoints are prefixed with `/api`. All request/response bodies are JSON. Errors return `{"error": "message"}`.

| Method | Path | Request Body | Response | Phase |
|---|---|---|---|---|
| `POST` | `/tailor` | `TailorRequest` | `TailorResponse` | P1 |
| `POST` | `/tailor/stream` | `TailorRequest` | SSE stream | P2 |
| `POST` | `/analyze-jd` | `{job_description}` | `{analysis}` | P1 |
| `POST` | `/compare` | `CompareRequest` | `CompareResponse` | P2 |
| `GET` | `/resume` | — | `{version, data}` | P1 |
| `PUT` | `/resume` | `MasterResumeData` | `{version, message}` | P1 |
| `POST` | `/resume/import` | `multipart/form-data` | `{version, data}` | P1 |
| `GET` | `/history` | query params | `HistoryItem[]` | P1 |
| `GET` | `/history/{id}` | — | `HistoryDetail` | P1 |
| `POST` | `/history/{id}/retailor` | `{mode?, model?}` | `TailorResponse` | P2 |
| `GET` | `/export/{id}/{format}` | — | binary file | P1 |
| `GET` | `/models/status` | — | `ModelsStatus` | P2 |
| `POST` | `/cover-letter` | `CoverLetterRequest` | `{cover_letter}` | P3 |

### 5.2 Core Request/Response Schemas

**TailorRequest:**

```json
{
  "job_description": "string (required, the full JD text)",
  "mode": "light | moderate | heavy  (default: moderate)",
  "model": "auto | local | azure  (default: auto)",
  "max_pages": "integer 1-3  (default: 1)",
  "tone": "professional | conversational | technical  (default: professional)",
  "validate": "boolean  (default: true)"
}
```

**TailorResponse:**

```json
{
  "id": "integer (history record ID)",
  "tailored_resume": "string (markdown)",
  "jd_analysis": {
    "job_title": "string",
    "company_name": "string",
    "required_skills": [{"name": "string", "weight": "critical|important|nice_to_have"}],
    "preferred_skills": ["string"],
    "years_experience": "integer | string",
    "responsibilities": ["string"],
    "industry_domain": "string",
    "tech_stack": ["string"],
    "soft_skills": ["string"],
    "cultural_indicators": ["string"]
  },
  "validation": {
    "is_valid": "boolean",
    "issues": [{"type": "string", "severity": "string", "description": "string"}],
    "keyword_match_score": "float (0-100)",
    "matched_keywords": ["string"],
    "missing_keywords": ["string"]
  },
  "ats_score": "float (0-100) | null"
}
```

**SSE Stream Format (for `/tailor/stream`):**

```
data: {"step": "analyzing", "progress": 0.1}

data: {"step": "mapping", "progress": 0.3}

data: {"step": "tailoring", "text": "# John Doe\n"}

data: {"step": "tailoring", "text": "Software engineer with..."}

data: {"step": "validating", "progress": 0.9}

data: {"step": "complete", "id": 42, "ats_score": 92.5, "validation": {...}}

data: [DONE]
```

### 5.3 Filtering & Pagination (History)

```
GET /api/history?company=google&role=engineer&model=local&limit=20&offset=0

Response:
[
  {
    "id": 42,
    "company": "Google",
    "role": "Senior Software Engineer",
    "mode": "moderate",
    "model": "local",
    "ats_score": 92.5,
    "created_at": "2026-03-09T14:30:00Z"
  }
]
```

All string filters use case-insensitive partial matching (`ILIKE %term%`). Results are always sorted by `created_at DESC` (newest first).

---

## 6. Intelligence Layer Design

### 6.1 Prompt Chain Architecture

The four prompts form a pipeline. Each prompt has a defined input schema, output schema, and failure mode.

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROMPT CHAIN                                │
│                                                                  │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌──────┐ │
│  │ EXTRACTION │───▶│  MAPPING   │───▶│ TAILORING  │───▶│VALID.│ │
│  │            │    │            │    │            │    │      │ │
│  │ In:  JD    │    │ In: JDA +  │    │ In: Map +  │    │In: T │ │
│  │      text  │    │      Resume│    │   Resume + │    │   +R │ │
│  │ Out: JDA   │    │ Out: Map   │    │   JDA      │    │Out:V │ │
│  │      (JSON)│    │     (JSON) │    │ Out: Resume│    │  (J) │ │
│  │            │    │            │    │    (MD)    │    │      │ │
│  │ Temp: 0.1  │    │ Temp: 0.1  │    │ Temp: 0.3  │    │T:0.0 │ │
│  │ Model: any │    │ Model: any │    │ Model: any │    │M:az. │ │
│  └────────────┘    └────────────┘    └────────────┘    └──────┘ │
│                                                                  │
│  JDA = JD Analysis    Map = Relevance Mapping                    │
│  T = Tailored Resume  R = Master Resume  V = Validation Result   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Prompt Design Principles

**Explicit output format.** Every prompt ends with "Return ONLY a JSON object" or "Return ONLY the Markdown resume." No ambiguity about what the LLM should produce.

**Low temperature for analysis, higher for writing.** Extraction (0.1) and validation (0.0) need deterministic, structured output. Tailoring (0.3) needs some creative latitude for rephrasing while remaining conservative enough to avoid fabrication.

**Delimiter-bounded inputs.** All user-provided content (JD text, master resume) is wrapped in `---` delimiters inside the prompt. This provides a defence against prompt injection through the JD field and gives the LLM clear boundaries between instructions and data.

**Schema-in-prompt.** The expected JSON output schema is included verbatim in each analysis prompt. This dramatically improves schema conformance, especially with smaller local models.

### 6.3 Tailoring Modes — Behavioural Specification

| Dimension | Light | Moderate | Heavy |
|---|---|---|---|
| Section reordering | Yes | Yes | Yes |
| Summary rewrite | Minor tweak | Full rewrite | Full rewrite |
| Bullet point editing | Keyword injection only | Rewrite for relevance | Rewrite + synthesise new |
| Content removal | Never | Irrelevant bullets only | Entire irrelevant sections |
| Skills reordering | Yes | Yes + demote irrelevant | Yes + remove irrelevant |
| Structural changes | None | Minor | Major (merge/split sections) |
| Risk of fabrication | Very low | Low | Medium (mitigated by validation) |
| Best use case | Close-match roles | Standard applications | Career pivots |

### 6.4 Validation Model Selection

The validation step (Step 4) deliberately uses a **different model** than the one that produced the tailored resume. If the tailoring was done by the local LLM, validation runs on Azure GPT 5.2 (or vice versa). This cross-model checking catches errors that a single model might consistently reproduce.

If only one model is available, validation still runs on the same model but with `temperature=0.0` and an explicitly adversarial system prompt ("You are a strict fact-checker. Your job is to find errors.").

---

## 7. Data Flow & Sequence Diagrams

### 7.1 Primary Flow — Quick Tailor (UC-1)

```
User                  Frontend              Backend               Model Router          LLM
 │                       │                     │                      │                  │
 │  Paste JD + tap       │                     │                      │                  │
 │  "Tailor"             │                     │                      │                  │
 │──────────────────────▶│                     │                      │                  │
 │                       │  POST /api/tailor   │                      │                  │
 │                       │────────────────────▶│                      │                  │
 │                       │                     │                      │                  │
 │                       │                     │  1. Load master      │                  │
 │                       │                     │     resume from DB   │                  │
 │                       │                     │                      │                  │
 │                       │                     │  2. Check JD cache   │                  │
 │                       │                     │     (SHA-256 hash)   │                  │
 │                       │                     │                      │                  │
 │                       │                     │  3a. generate()      │                  │
 │                       │                     │  [extraction prompt] │                  │
 │                       │                     │─────────────────────▶│  health check    │
 │                       │                     │                      │─────────────────▶│
 │                       │                     │                      │◀─────────────────│
 │                       │                     │                      │  select model    │
 │                       │                     │                      │─────────────────▶│
 │                       │                     │                      │  JD Analysis     │
 │                       │                     │◀─────────────────────│◀─────────────────│
 │                       │                     │                      │                  │
 │                       │                     │  3b. generate()      │                  │
 │                       │                     │  [mapping prompt]    │                  │
 │                       │                     │─────────────────────▶│─────────────────▶│
 │                       │                     │◀─────────────────────│◀─────────────────│
 │                       │                     │                      │                  │
 │                       │                     │  3c. generate()      │                  │
 │                       │                     │  [tailoring prompt]  │                  │
 │                       │                     │─────────────────────▶│─────────────────▶│
 │                       │                     │◀─────────────────────│◀─────────────────│
 │                       │                     │                      │                  │
 │                       │                     │  3d. generate()      │                  │
 │                       │                     │  [validation prompt] │  (different model)
 │                       │                     │─────────────────────▶│─────────────────▶│
 │                       │                     │◀─────────────────────│◀─────────────────│
 │                       │                     │                      │                  │
 │                       │                     │  4. Save to history  │                  │
 │                       │                     │     (TailoredResume) │                  │
 │                       │                     │                      │                  │
 │                       │  TailorResponse     │                      │                  │
 │                       │◀────────────────────│                      │                  │
 │                       │                     │                      │                  │
 │  Navigate to          │                     │                      │                  │
 │  /preview/{id}        │                     │                      │                  │
 │◀──────────────────────│                     │                      │                  │
```

### 7.2 Streaming Flow (Phase 2)

```
User          Frontend                 Backend                    LLM
 │               │                        │                        │
 │  Tap Tailor   │                        │                        │
 │──────────────▶│                        │                        │
 │               │  POST /api/tailor/     │                        │
 │               │       stream (SSE)     │                        │
 │               │───────────────────────▶│                        │
 │               │                        │                        │
 │               │  SSE: {step:analyzing} │                        │
 │               │◀───────────────────────│  [runs steps 1-2]     │
 │  "Analyzing   │                        │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶│
 │   job..."     │                        │                        │
 │◀──────────────│                        │                        │
 │               │  SSE: {step:tailoring, │  [step 3, streaming]   │
 │               │        text: chunk}    │◀ ─ ─ chunk ─ ─ ─ ─ ─ ─│
 │               │◀───────────────────────│                        │
 │  Resume text  │  SSE: {text: chunk}    │◀ ─ ─ chunk ─ ─ ─ ─ ─ ─│
 │  appears      │◀───────────────────────│                        │
 │  token by     │  SSE: {text: chunk}    │◀ ─ ─ chunk ─ ─ ─ ─ ─ ─│
 │  token        │◀───────────────────────│                        │
 │◀──────────────│         ...            │                        │
 │               │                        │                        │
 │               │  SSE: {step:complete,  │  [step 4 runs async]   │
 │               │   id, ats_score, ...}  │                        │
 │               │◀───────────────────────│                        │
 │  ATS badge    │  SSE: [DONE]           │                        │
 │  appears      │◀───────────────────────│                        │
 │◀──────────────│                        │                        │
```

### 7.3 Model Failover Flow

```
Backend                  Model Router                Local LLM        Azure GPT 5.2
   │                          │                          │                 │
   │  generate(prefer=auto)   │                          │                 │
   │─────────────────────────▶│                          │                 │
   │                          │  health_check_local()    │                 │
   │                          │─────────────────────────▶│                 │
   │                          │  ✗ timeout (3s)          │                 │
   │                          │◀ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                 │
   │                          │                          │                 │
   │                          │  try tunnel URL          │                 │
   │                          │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶│                 │
   │                          │  ✗ timeout (3s)          │                 │
   │                          │◀ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                 │
   │                          │                          │                 │
   │                          │  [local unavailable]     │                 │
   │                          │  fallback to Azure       │                 │
   │                          │──────────────────────────┼────────────────▶│
   │                          │                          │                 │
   │                          │  response                │                 │
   │                          │◀─────────────────────────┼─────────────────│
   │  response                │                          │                 │
   │◀─────────────────────────│                          │                 │
```

### 7.4 Resume Import Flow

```
User             Frontend              Backend              Model Router
 │                  │                     │                      │
 │  Upload PDF      │                     │                      │
 │─────────────────▶│                     │                      │
 │                  │  POST /resume/      │                      │
 │                  │   import (multipart)│                      │
 │                  │────────────────────▶│                      │
 │                  │                     │  PyPDF2: extract     │
 │                  │                     │  raw text            │
 │                  │                     │                      │
 │                  │                     │  generate() with     │
 │                  │                     │  parsing prompt      │
 │                  │                     │─────────────────────▶│──▶ LLM
 │                  │                     │◀─────────────────────│◀── JSON
 │                  │                     │                      │
 │                  │                     │  Pydantic validate   │
 │                  │                     │  MasterResumeData    │
 │                  │                     │                      │
 │                  │                     │  Store in DB         │
 │                  │                     │  (version=1)         │
 │                  │                     │                      │
 │                  │  {version, data}    │                      │
 │                  │◀────────────────────│                      │
 │  Redirect to     │                     │                      │
 │  Resume Editor   │                     │                      │
 │◀─────────────────│                     │                      │
```

---

## 8. Frontend Architecture

### 8.1 Component Tree

```
App
├── Navigation (fixed bottom bar)
│
├── Route: / → Dashboard
│   ├── JDInput (textarea)
│   ├── IntensityToggle (light | moderate | heavy)
│   ├── ModelSelector (auto | local | azure)
│   ├── TailorButton
│   └── RecentGenerations (last 5 from history)
│
├── Route: /preview/:id → Preview
│   ├── ResumePreview (formatted markdown render)
│   ├── StreamingText (SSE consumer, shown during generation)
│   ├── ATSBadge (score indicator)
│   ├── JDAnalysisPanel (collapsible: keywords, gaps)
│   ├── ExportBar (PDF | DOCX | MD | Copy)
│   └── InlineEditor (Phase 3: contenteditable overlay)
│
├── Route: /history → History
│   ├── SearchBar (text input)
│   ├── FilterBar (company, role, model, date range)
│   └── HistoryCard[] (scrollable list)
│       ├── CompanyBadge
│       ├── RoleName
│       ├── ATSBadge
│       ├── ModelIndicator
│       └── DateStamp
│
├── Route: /resume → ResumeEditor
│   ├── TabSwitcher (Form View | JSON View)
│   ├── FormView
│   │   ├── ContactSection
│   │   ├── SummarySection
│   │   ├── ExperienceSection (drag-and-drop sortable)
│   │   ├── SkillsSection
│   │   ├── ProjectsSection
│   │   ├── EducationSection
│   │   └── CertificationsSection
│   ├── JSONView (code editor)
│   └── VersionSidebar (Phase 3: version list + rollback)
│
└── Route: /settings → Settings
    ├── ModelConfig (endpoints, API keys — stored in backend .env)
    ├── DefaultPreferences (format, intensity, tone)
    ├── TemplateSelector (Phase 3)
    └── DataManagement (export all, clear history)
```

### 8.2 State Management

The frontend uses **React state + URL params** only. No global state library. The application is simple enough that prop drilling and `useContext` for the rare shared state (e.g., model status) are sufficient.

| State | Scope | Storage |
|---|---|---|
| JD text, mode, model selection | Dashboard page | `useState` (ephemeral) |
| Streaming resume text | Preview page | `useSSE` hook (ephemeral) |
| History list | History page | `useState` + `useEffect` fetch |
| Master resume form data | Editor page | `useState` + PUT on save |
| Model availability status | Global (context) | `useContext` + periodic fetch |
| Current preview data | URL param `/preview/:id` | Fetched from `/api/history/:id` |

**No client-side cache** beyond the service worker's offline cache for static assets. All data is fetched from the API on each page load. This keeps the frontend stateless and avoids stale-data bugs.

### 8.3 Responsive Breakpoints

| Breakpoint | Viewport | Layout Behaviour |
|---|---|---|
| Default (mobile) | < 640px | Single column. Bottom nav. Full-width inputs. |
| `sm` | ≥ 640px | Minor spacing increases. Still single column. |
| `md` | ≥ 768px | Two-column layout on Preview (resume + JD panel side-by-side). |
| `lg` | ≥ 1024px | Three-column on History (filters sidebar + list + preview). Editor shows form + JSON side-by-side. |

---

## 9. Networking & Connectivity Design

### 9.1 Network Topology

```
                                    INTERNET
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
              ┌─────▼─────┐    ┌──────▼──────┐    ┌─────▼─────┐
              │  Phone     │    │  Azure App  │    │  Azure AI │
              │  Browser   │    │  Service    │    │  Foundry  │
              └─────┬──────┘    │  (backend)  │    │  (GPT5.2) │
                    │          └──────┬──────┘    └─────▲─────┘
                    │  HTTPS          │                  │
                    └────────────────▶│  HTTPS (API call)│
                                      │─────────────────▶│
                                      │                  │
                                      │  Cloudflare      │
                                      │  Tunnel (HTTPS)  │
                                      │                  │
                               ┌──────▼──────┐           │
                               │  Home PC    │           │
                               │  (Ollama)   │           │
                               └─────────────┘           │
                                                         │
              ┌──────────┐                               │
              │ Desktop   │  localhost:8000 (dev)         │
              │ Browser   │──────────────────────────────▶│
              └──────────┘   (or via Azure too)
```

### 9.2 Connection Modes

| Scenario | Frontend → Backend | Backend → LLM | Latency |
|---|---|---|---|
| Desktop, at home, dev mode | localhost:5173 → localhost:8000 | localhost:8000 → localhost:11434 | Lowest (~50ms overhead) |
| Desktop, at home, deployed | Azure URL → Azure App Service | Azure → Cloudflare Tunnel → localhost:11434 | Low (~200ms overhead) |
| Phone, at home (same WiFi) | LAN IP:8000 (or Azure URL) | Backend → localhost:11434 | Low |
| Phone, on the go | Azure URL → Azure App Service | Azure → Cloudflare Tunnel → home PC | Medium (~500ms overhead) |
| Phone, home PC off | Azure URL → Azure App Service | Azure → Azure GPT 5.2 (fallback) | Medium (cloud inference) |

### 9.3 Cloudflare Tunnel Architecture

```
Home PC                          Cloudflare Edge              Azure App Service
┌──────────┐                    ┌──────────────┐             ┌──────────────┐
│  Ollama  │◀───── encrypted ──▶│  Tunnel      │◀── HTTPS ──│  Backend     │
│  :11434  │       tunnel       │  Endpoint    │             │  (Model      │
│          │       (outbound    │  (llm.your   │             │   Router)    │
│ cloudflr │        only, no    │   domain.com)│             │              │
│  daemon  │        port fwd)   │              │             │              │
└──────────┘                    └──────────────┘             └──────────────┘
```

The tunnel connection is always **outbound from the home PC**. No router port forwarding needed. The `cloudflared` daemon maintains a persistent connection to Cloudflare's edge. When the backend makes a request to `llm.yourdomain.com`, Cloudflare routes it through the tunnel to the home PC's Ollama instance.

---

## 10. Security Design

### 10.1 Threat Model

| Threat | Severity | Mitigation |
|---|---|---|
| API key exposure in frontend | High | Keys stored in backend `.env` only. Frontend never sees them. Backend proxies all LLM calls. |
| Prompt injection via JD text | Medium | JD text wrapped in `---` delimiters. System prompt uses instruction hierarchy. Input length capped at 10,000 characters. |
| Unauthorised access to web UI | Medium | Optional basic auth on the FastAPI app (single-user system). HTTPS enforced via Azure/Cloudflare. |
| Resume data exfiltration | Low | Local-first architecture. Cloud calls send only JD + resume content. No telemetry. No third-party analytics. |
| Tunnel hijacking | Low | Cloudflare Tunnel uses authenticated, encrypted connections. Tunnel token is secret. |
| SQLite file theft | Low | Database file lives on the backend server. Not exposed via any endpoint. Cloud deployment uses Azure's filesystem isolation. |

### 10.2 Input Sanitisation

All user-provided text (JD, resume edits) goes through a sanitisation step before being inserted into prompts:

```python
def sanitise_for_prompt(text: str, max_length: int = 10000) -> str:
    text = text[:max_length]
    text = text.replace("```", "")
    text = text.replace("---SYSTEM---", "")
    text = text.replace("IGNORE PREVIOUS", "")
    return text
```

This is a defence-in-depth measure. The primary defence is the delimiter-based prompt structure and the instruction hierarchy (system prompt > user prompt > data section).

### 10.3 Authentication (Optional)

For single-user deployment, a simple bearer token or basic auth is sufficient. The `APP_SECRET_KEY` environment variable doubles as the bearer token. If it is empty, authentication is disabled (local development mode).

---

## 11. Error Handling & Resilience

### 11.1 Error Taxonomy

| Error Type | Source | Handling |
|---|---|---|
| LLM unreachable | Model Router | Failover to next model in priority chain. If all fail, return 503 with descriptive message. |
| LLM returns invalid JSON | Prompt chain | Retry once with a "fix this JSON" follow-up prompt. If still invalid, return partial result with warning. |
| LLM hallucination detected | Validation step | Flag in response (`validation.issues[]`). UI highlights flagged content in red. Do not block export. |
| Database write failure | SQLite | Return 500. Log error. Transaction rollback is automatic (SQLModel sessions). |
| Resume import parse failure | Resume Parser | Retry LLM parsing once. If Pydantic validation still fails, return the validation errors so the user can manually fix the JSON. |
| Export rendering failure | WeasyPrint | Return 500 with error detail. Offer markdown download as fallback. |
| Rate limit hit (Azure) | Model Router | Exponential backoff: 1s, 2s, 4s, then fail. Return 429 to frontend. |

### 11.2 Retry Strategy

```
Model Router retries:
  max_retries: 2
  backoff: exponential (1s, 2s, 4s)
  retry_on: timeout, 429, 500, 502, 503

JSON parsing retries:
  max_retries: 1
  strategy: send the malformed output back to the LLM with
            "Fix this JSON: {error_message}. Original: {output}"

Health check caching:
  cache_duration: 30 seconds
  strategy: after a successful check, skip re-checking for 30s
            after a failed check, retry immediately on next request
```

### 11.3 Graceful Degradation

| Failure | Degraded Behaviour |
|---|---|
| All LLMs unavailable | UI shows "No models available" with a retry button. History and resume editing remain functional. |
| Validation step fails | Tailored resume is still returned. ATS score shows "N/A". A warning banner says "Validation unavailable — please review manually." |
| PDF export fails | Markdown download is offered as fallback. |
| JD analysis cache miss + LLM slow | UI shows streaming progress. Steps 1–2 take longer but the user sees "Analysing job description..." status. |

---

## 12. State Management

### 12.1 Backend State

All backend state lives in the SQLite database. The backend process is stateless — it can be restarted at any time without data loss.

```
SQLite Database (resumeforge.db)
├── master_resume       # Append-only version history
├── tailored_resume     # All generated resumes + metadata
├── jd_analysis         # Cached JD analyses (keyed by hash)
└── (future) user_settings  # Preferences, template selection
```

**Write patterns:**

- Master resume updates: read-modify-write with version increment (single writer, no concurrency concern)
- Tailoring results: insert-only (append to history)
- JD cache: insert-if-not-exists (idempotent)

**No migrations framework in Phase 1.** SQLModel's `create_all()` handles table creation on first run. Alembic is introduced in Phase 2 when schema may evolve.

### 12.2 Frontend State

```
                    ┌───────────────────────────────┐
                    │       React State Tree         │
                    │                                │
                    │  App (root)                    │
                    │  └── ModelStatusContext         │
                    │       {local: bool,            │
                    │        azure: bool}            │
                    │                                │
                    │  Dashboard (page state)        │
                    │  ├── jdText: string             │
                    │  ├── mode: enum                 │
                    │  ├── model: enum                │
                    │  └── isLoading: bool            │
                    │                                │
                    │  Preview (page state)           │
                    │  ├── resumeData: TailorResponse │
                    │  ├── streamText: string         │
                    │  └── streamDone: bool           │
                    │                                │
                    │  History (page state)           │
                    │  ├── items: HistoryItem[]       │
                    │  ├── filters: object            │
                    │  └── isLoading: bool            │
                    │                                │
                    │  ResumeEditor (page state)     │
                    │  ├── resumeData: MasterResume   │
                    │  ├── activeTab: form|json       │
                    │  └── isDirty: bool              │
                    └───────────────────────────────┘
```

---

## 13. Export & Rendering Pipeline

### 13.1 Format Matrix

| Format | Engine | Template Support | File Size | Phase |
|---|---|---|---|---|
| PDF | WeasyPrint (HTML/CSS → PDF) | Yes (Jinja2 templates) | ~50–150 KB | P1 |
| DOCX | python-docx (line-by-line) | Limited (single layout) | ~20–50 KB | P1 |
| Markdown | Passthrough | N/A | ~3–8 KB | P1 |
| Plain text | Strip markdown syntax | N/A | ~2–6 KB | P1 |

### 13.2 PDF Rendering Pipeline

```
Tailored Resume       Markdown           HTML               Template HTML          PDF
(markdown string) ──▶ Parser ──▶ (HTML fragment) ──▶ Jinja2 Render ──▶ WeasyPrint ──▶ bytes
                     (Python                        (inject into
                      markdown                       selected
                      library)                       template)

Template provides:
├── @page rules (size, margins)
├── Typography (font family, sizes, line height)
├── Section styling (h1, h2, h3, ul, li)
├── Layout (single-column, two-column, sidebar)
└── Colour scheme
```

### 13.3 ATS Score Calculation

The ATS score is a simple keyword coverage metric, computed after Step 4 (validation) or independently if validation is skipped.

```
Input:
  required_keywords: ["python", "fastapi", "docker", "kubernetes", "ci/cd"]
  tailored_resume_text: "...full markdown text..."

Algorithm:
  1. Lowercase both inputs
  2. For each keyword, check if it appears as a substring in the resume text
  3. Score = (matched_count / total_keywords) × 100

Output:
  ats_score: 80.0  (4 of 5 keywords matched)
  matched: ["python", "fastapi", "docker", "ci/cd"]
  missing: ["kubernetes"]
```

This is intentionally simplistic. A more sophisticated approach (TF-IDF, semantic similarity) is a Phase 4 enhancement.

---

## 14. Deployment Architecture

### 14.1 Production Topology

```
┌──────────────────────────────────────────────────────────┐
│                     AZURE CLOUD                           │
│                                                          │
│  ┌─────────────────────────┐  ┌──────────────────────┐   │
│  │  Azure App Service      │  │  Azure AI Foundry    │   │
│  │  (Free Tier / B1)       │  │                      │   │
│  │                         │  │  GPT 5.2 deployment  │   │
│  │  ┌───────────────────┐  │  │                      │   │
│  │  │  Docker Container │  │  └──────────▲───────────┘   │
│  │  │                   │  │             │               │
│  │  │  FastAPI + Static │  │  HTTPS      │               │
│  │  │  Frontend         │──│─────────────┘               │
│  │  │                   │  │                             │
│  │  │  SQLite DB        │  │  Cloudflare Tunnel          │
│  │  │  (persistent vol) │──│─────────────┐               │
│  │  └───────────────────┘  │             │               │
│  └─────────────────────────┘             │               │
│                                          │               │
└──────────────────────────────────────────┼───────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │  Home PC    │
                                    │             │
                                    │  Ollama     │
                                    │  :11434     │
                                    │             │
                                    │  cloudflared│
                                    │  daemon     │
                                    └─────────────┘
```

### 14.2 Container Design

Single container, multi-stage build. The frontend is compiled to static files in the build stage and served by FastAPI in the runtime stage.

```
Build Stage 1 (Node):   frontend/ → npm run build → /app/dist/
Build Stage 2 (Python): backend/ + dist/ → single image
Runtime:                 uvicorn serves API + static frontend
```

### 14.3 Persistent Storage

| Data | Location | Backup Strategy |
|---|---|---|
| SQLite database | `/app/data/resumeforge.db` (Docker volume) | Azure: mounted persistent storage. Oracle: host volume. |
| Generated files | `/app/data/exports/` (Docker volume) | Same volume as database. |
| Prompt templates | `/app/app/prompts/` (baked into image) | Version controlled in Git. |

---

## 15. Performance Budget

### 15.1 Time Budgets

| Operation | Local LLM | Cloud (GPT 5.2) | Target |
|---|---|---|---|
| Step 1: JD Extraction | 10–20s | 3–8s | < 20s |
| Step 2: Mapping | 10–20s | 3–8s | < 20s |
| Step 3: Tailoring | 20–40s | 8–15s | < 45s |
| Step 4: Validation | 10–20s | 3–8s | < 20s |
| **Total pipeline** | **50–100s** | **17–39s** | **< 120s** |
| PDF export | < 2s | < 2s | < 3s |
| Page load (frontend) | < 1s | < 1s | < 1.5s |
| History list fetch | < 200ms | < 200ms | < 500ms |

### 15.2 Size Budgets

| Asset | Budget |
|---|---|
| Frontend bundle (gzipped) | < 200 KB |
| SQLite database (1000 resumes) | < 50 MB |
| Single tailored resume (markdown) | < 10 KB |
| PDF export | < 200 KB |
| Docker image | < 500 MB |

### 15.3 Token Usage Estimates (Per Tailoring)

| Step | Input Tokens | Output Tokens | Estimated Cost (Azure) |
|---|---|---|---|
| Extraction | ~1,500 (JD) | ~800 (analysis JSON) | ~$0.003 |
| Mapping | ~3,000 (JD analysis + resume) | ~1,200 (mapping JSON) | ~$0.006 |
| Tailoring | ~4,000 (mapping + resume + JD) | ~2,000 (full resume) | ~$0.009 |
| Validation | ~3,500 (tailored + master + keywords) | ~500 (validation JSON) | ~$0.005 |
| **Total** | **~12,000** | **~4,500** | **~$0.023** |

At 50 applications/month on cloud: ~$1.15/month. Well within the $5 budget. With local LLM as primary: ~$0/month.

---

## 16. Design Decisions Log

This section records key architectural decisions, the alternatives considered, and the rationale for the choice made.

### DD-01: Structured JSON over raw text for master resume

**Decision:** Store the master resume as typed JSON with a formal schema, not as a PDF/DOCX/markdown blob.

**Alternatives considered:** (a) Store as markdown, (b) Store as DOCX and parse on demand, (c) Store as raw text.

**Rationale:** Structured JSON enables precise section-level manipulation by the LLM (reorder sections, remove specific bullets, inject keywords into specific entries). Raw text forces the LLM to re-parse structure on every call, introducing errors. JSON also enables the form-based editor UI and type-safe Pydantic validation.

**Trade-off:** Initial onboarding is harder (user must import and verify). Mitigated by the LLM-powered import service.

---

### DD-02: 4-step prompt chain over single monolithic prompt

**Decision:** Decompose tailoring into four discrete prompts (extract → map → tailor → validate).

**Alternatives considered:** (a) Single "tailor this resume for this JD" prompt, (b) Two-step (analyze + tailor), (c) Agent-style loop.

**Rationale:** Each step has a distinct input/output contract, making the system debuggable and testable at each stage. If the extraction is wrong, you fix the extraction prompt without touching the tailoring prompt. The mapping step produces an explicit relevance score that can be displayed to the user. The validation step catches hallucinations. A monolithic prompt conflates all these concerns and produces inconsistent quality.

**Trade-off:** 4× the LLM calls = 4× the latency and cost. Mitigated by local LLM (free) and acceptable total time (< 2 minutes).

---

### DD-03: SQLite over PostgreSQL

**Decision:** Use SQLite as the sole database.

**Alternatives considered:** (a) PostgreSQL, (b) DynamoDB, (c) JSON files on disk.

**Rationale:** Single-user system with no concurrent writers. SQLite is zero-config, file-based, trivially portable, and backed up by copying a single file. PostgreSQL adds operational complexity (process management, connection pooling, migrations) with no benefit for this use case. SQLModel's ORM layer means migrating to PostgreSQL later requires changing one connection string.

**Trade-off:** No concurrent write support. Acceptable for single-user.

---

### DD-04: Cloudflare Tunnel over port forwarding or VPN

**Decision:** Use Cloudflare Tunnel for remote access to the local LLM.

**Alternatives considered:** (a) Router port forwarding + DDNS, (b) Tailscale/WireGuard VPN, (c) Run Ollama in the cloud.

**Rationale:** Cloudflare Tunnel is free, requires no router configuration, maintains a persistent outbound connection (no NAT issues), and provides automatic HTTPS. Port forwarding exposes the home network. VPN requires installing a client on every device. Running Ollama in the cloud defeats the cost-free local inference goal.

**Trade-off:** Dependency on Cloudflare's free service. If they discontinue it, fallback to Tailscale.

---

### DD-05: React over Svelte for frontend

**Decision:** Use React (with Vite) for the frontend.

**Alternatives considered:** (a) Svelte/SvelteKit, (b) Vue 3, (c) Plain HTML + HTMX.

**Rationale:** React has the largest ecosystem, the most available UI components (shadcn/ui, Lucide icons), and the best tooling support. The developer is familiar with React from prior projects. Svelte would produce a smaller bundle but the ecosystem is smaller. HTMX would be simpler but SSE handling and rich UI components (drag-and-drop editor, inline editing) are harder.

**Trade-off:** Larger bundle than Svelte. Mitigated by Vite's tree-shaking and the 200KB budget being easily achievable.

---

### DD-06: WeasyPrint over Puppeteer for PDF generation

**Decision:** Use WeasyPrint for PDF rendering.

**Alternatives considered:** (a) Puppeteer/Playwright (headless Chrome), (b) wkhtmltopdf, (c) LaTeX.

**Rationale:** WeasyPrint is Python-native (no external browser binary), produces high-quality PDF from HTML/CSS, and is lightweight enough for a Docker container. Puppeteer requires a ~400MB Chromium binary, increasing image size and memory usage. LaTeX produces beautiful PDFs but has a steep learning curve for template creation and a heavy install footprint.

**Trade-off:** WeasyPrint's CSS support is narrower than Chrome's (no flexbox, limited grid). Mitigated by using simple, well-supported CSS layouts for resume templates.

---

### DD-07: Append-only history over mutable records

**Decision:** Every tailored resume is stored as a new row. Nothing is updated or deleted.

**Alternatives considered:** (a) Keep only the latest per company/role, (b) Allow manual deletion, (c) Auto-purge after 90 days.

**Rationale:** Full history enables traceability (what did I send Google in February?), re-tailoring (generate a new version with updated master resume), and analytics (which skills am I tailoring for most?). Storage is cheap — 1,000 records is < 50MB. Manual deletion can be added later as a Settings feature without changing the data model.

**Trade-off:** Database grows indefinitely. Mitigated by the low per-record size and optional future purge feature.

---

### DD-08: SSE over WebSocket for streaming

**Decision:** Use Server-Sent Events for real-time streaming of the tailored resume.

**Alternatives considered:** (a) WebSocket, (b) Long polling, (c) No streaming (wait for complete response).

**Rationale:** SSE is simpler than WebSocket for unidirectional server-to-client streaming, works over standard HTTP (no upgrade handshake), is natively supported by browsers (`EventSource`), and is well-supported by FastAPI's `StreamingResponse`. WebSocket is bidirectional, which is unnecessary here — the client sends one request and receives a stream of tokens. Long polling is less efficient. No streaming means the user stares at a spinner for 60–120 seconds.

**Trade-off:** SSE doesn't support binary data or client-to-server messages. Not needed for this use case.
