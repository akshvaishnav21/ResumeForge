# ResumeForge — Product Requirements Document

**AI-Powered Resume Tailoring System**

| Field | Value |
|---|---|
| Document Title | Resume Tailoring Tool – PRD |
| Version | 1.0 |
| Author | AV |
| Status | Draft |
| Created | March 9, 2026 |
| Last Updated | March 9, 2026 |
| Stakeholders | AV (sole developer / user) |

---

## 1. Executive Summary

ResumeForge is a personal, AI-powered tool that automates the process of tailoring a master resume to individual job descriptions. It eliminates the repetitive manual work of customising resumes for each application while ensuring keyword alignment, contextual relevance, and professional formatting.

The system leverages a multi-model architecture — combining a local offline LLM for cost-free daily use, Azure-hosted GPT 5.2 for high-stakes applications, and an optional Gemini API for validation — exposed through a mobile-friendly web interface so that resumes can be generated from any device, anywhere.

---

## 2. Problem Statement

### 2.1 Current Pain Points

- **Time drain:** Manually tailoring a resume for a single job takes 20–45 minutes. Across 10–20 applications per week, this consumes 4–15 hours.
- **Inconsistent quality:** Fatigue leads to generic resumes that fail to match the job's specific language, resulting in lower ATS pass-through rates.
- **Keyword blind spots:** Job descriptions embed requirements in varied phrasing; humans frequently miss synonyms or contextual matches.
- **Version chaos:** Dozens of resume variants accumulate with no clear record of what was sent where.

### 2.2 Opportunity

LLMs can reliably extract requirements from job descriptions, map them to existing experience, and rewrite content with contextual precision — all in seconds. A well-designed system turns a 30-minute manual task into a 2-minute automated one while improving output quality.

---

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Reduce tailoring time | Time from JD input to final resume output | < 2 minutes per application |
| Improve keyword match | Percentage of critical JD keywords present in tailored resume | > 90% coverage |
| Cross-device access | Fully functional on mobile browsers | 100% feature parity on mobile |
| Cost efficiency | Monthly API spend for typical usage (50 applications/month) | < $5/month (primarily local LLM) |
| Version tracking | Every tailored resume linked to its source JD and timestamp | 100% traceability |

---

## 4. User Personas & Use Cases

### 4.1 Primary Persona: Active Job Seeker (You)

A technically proficient individual applying to multiple roles weekly. Comfortable with APIs and local tooling. Values speed, data privacy, and control over the output. Uses both desktop (at home) and mobile (on the go) to discover and apply to jobs.

### 4.2 Core Use Cases

| UC # | Use Case | Description |
|---|---|---|
| UC-1 | Quick Tailor | Paste a job description, select tailoring intensity (light/moderate/heavy), receive a tailored resume in < 2 minutes. |
| UC-2 | Batch Tailor | Upload multiple JDs (e.g., from a spreadsheet or folder) and generate tailored resumes for all in one run. |
| UC-3 | Model Comparison | Run the same JD through two models (e.g., local + GPT 5.2) and view a side-by-side diff of the outputs. |
| UC-4 | Resume History | Browse previously generated resumes by date, company, or role. Re-download or re-tailor from history. |
| UC-5 | Master Resume Update | Edit the master resume (add a new project, update skills), with changes propagated to the tailoring engine immediately. |
| UC-6 | Cover Letter Generation | Optionally generate a matching cover letter using the same JD analysis. |

---

## 5. System Architecture

### 5.1 High-Level Architecture

The system follows a three-tier architecture designed for flexibility, offline capability, and cross-device access.

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  PRESENTATION LAYER  │     │  APPLICATION LAYER   │     │  INTELLIGENCE LAYER  │
│                     │     │                     │     │                     │
│  Mobile-First       │────▶│  FastAPI Backend     │────▶│  Multi-Model Router  │
│  Web UI             │     │                     │     │                     │
│                     │     │  • REST API          │     │  • Local LLM         │
│  • Responsive SPA   │     │    endpoints         │     │    (Ollama/LM Studio)│
│    (React/Svelte)   │     │  • Prompt            │     │  • Azure GPT 5.2     │
│  • PWA-capable      │     │    orchestration      │     │    (cloud fallback)  │
│  • Markdown preview │     │  • SQLite history     │     │  • Gemini API        │
│  • PDF export       │     │    store             │     │    (validator)        │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### 5.2 Component Breakdown

#### 5.2.1 Frontend – Web UI

- **Framework:** React (with Vite) or Svelte – lightweight, fast, excellent mobile performance.
- **Styling:** Tailwind CSS for rapid, responsive design.
- **PWA:** Service worker for offline caching of static assets; app installable on home screen.
- **Core screens:** Dashboard (quick tailor), History, Master Resume Editor, Settings.
- **Export:** Client-side PDF generation (html2pdf or Puppeteer on backend), DOCX export via docx library.

#### 5.2.2 Backend – FastAPI Service

- **Language:** Python 3.11+
- **Framework:** FastAPI with async support for concurrent model calls.
- **Database:** SQLite (via SQLModel ORM) for history, settings, and master resume storage. Lightweight, zero-config, portable.
- **File storage:** Local filesystem or cloud-synced folder (Google Drive/OneDrive mount) for generated resume files.
- **Config:** Environment variables for API keys, model endpoints, and feature flags.

#### 5.2.3 Intelligence Layer – Multi-Model Router

The router abstracts model selection behind a unified interface. The application code calls `router.generate(prompt)` and the router handles model selection, failover, and response normalization.

| Model | Provider | Use Case | Cost | Priority |
|---|---|---|---|---|
| Local LLM | Ollama / LM Studio | Default for all requests | Free | Primary |
| GPT 5.2 | Azure AI Foundry | High-stakes / fallback | Per-token | Secondary |
| Gemini | Google AI | Validation / comparison | Per-token | Optional |

**Routing logic:** If the local LLM is reachable (health check via `/health` endpoint), route there. If unreachable or if user explicitly selects cloud, route to Azure GPT 5.2. If comparison mode is active, send to both local and GPT 5.2 (and optionally Gemini) in parallel.

### 5.3 Networking & Deployment

| Component | Deployment Target | Access Method |
|---|---|---|
| Web UI + Backend | Azure App Service (free tier) OR Oracle Cloud free-tier VM | Public URL (HTTPS) |
| Local LLM | Home desktop/laptop (always-on or on-demand) | Cloudflare Tunnel (secure, no port forwarding) |
| Database | Co-located with backend (SQLite file) | Internal only |
| File Storage | Backend filesystem + optional cloud sync | Via API endpoints |

---

## 6. Core Features (Detailed)

### 6.1 Master Resume Management

The master resume is the single source of truth containing all experience, skills, projects, education, and certifications. It is stored in structured JSON/YAML format for optimal LLM processing.

- **Storage format:** JSON with clearly defined sections (`contact`, `summary`, `experience[]`, `skills[]`, `projects[]`, `education[]`, `certifications[]`).
- **Editing:** Web-based form UI for structured editing. Raw JSON/YAML editor for power users.
- **Versioning:** Each edit creates a timestamped snapshot. Users can roll back to any previous version.
- **Import:** Upload existing resume as PDF or DOCX; LLM parses it into structured format for initial setup.

### 6.2 Job Description Analysis

Before tailoring, the system performs a structured analysis of the job description using a dedicated extraction prompt. This two-step approach (analyze, then tailor) produces significantly better results than a single-pass rewrite.

- **Extracted fields:** Job title, company name, required skills, preferred skills, years of experience, key responsibilities, industry domain, technology stack, soft skills, and cultural indicators.
- **Keyword weighting:** Skills and requirements are assigned priority weights (critical, important, nice-to-have) based on their position and emphasis in the JD.
- **Gap analysis:** The system identifies mismatches between the JD requirements and the master resume, flagging areas where the user may want to add content or where creative reframing is needed.

### 6.3 Resume Tailoring Engine

The core engine takes the JD analysis output and the master resume, then generates a tailored version. Users can control the intensity of tailoring.

#### 6.3.1 Tailoring Modes

| Mode | Behaviour | Best For |
|---|---|---|
| Light | Reorders sections by relevance; injects missing keywords into existing bullet points; adjusts summary/objective. | Roles closely matching existing resume; minimal rewrite needed. |
| Moderate | All of Light, plus: rewrites bullet points to emphasize relevant achievements; adjusts skills section order; may remove irrelevant items. | Most standard job applications; good balance of authenticity and optimization. |
| Heavy | All of Moderate, plus: significantly restructures content; creates new bullet points from master resume data; may synthesize experience descriptions that combine multiple roles. | Career pivots, aspirational roles, or highly competitive applications. |

#### 6.3.2 Prompt Architecture

The tailoring process uses a multi-prompt chain, not a single monolithic prompt. This ensures higher quality and debuggability at each step.

1. **Extraction Prompt:** Parse the JD into structured requirements (see 6.2).
2. **Mapping Prompt:** Match extracted requirements to master resume entries. Output a relevance score for each resume item against each JD requirement.
3. **Tailoring Prompt:** Using the mapping, rewrite the resume at the selected intensity level. Includes explicit instructions on formatting, tone, and length constraints.
4. **Validation Prompt (optional):** A separate model (Gemini or a second call to GPT 5.2) reviews the output for factual consistency with the master resume — catches hallucinated experience or inflated claims.

### 6.4 Output & Export

- **Preview:** Rendered in-browser with real-time formatting preview.
- **Formats:** PDF (primary), DOCX, Markdown, and plain text.
- **Templates:** Multiple resume templates/layouts. Users can set a default or choose per-export.
- **Inline editing:** Post-generation, users can manually tweak the output before exporting.
- **ATS check:** A lightweight ATS compatibility score shown alongside the output (keyword match %, format compatibility).

### 6.5 History & Tracking

- **Record:** Every generated resume is stored with its source JD, model used, tailoring mode, timestamp, and company/role metadata.
- **Search & filter:** Filter by company, role, date range, model used.
- **Re-tailor:** One-click re-generation from history (e.g., after updating master resume).
- **Analytics:** Basic stats — number of resumes generated, most common skills matched, model usage breakdown.

### 6.6 Cover Letter Generation (Phase 2)

Using the same JD analysis, the system can optionally generate a matching cover letter. This uses a dedicated prompt template that references the tailored resume to ensure consistency. Cover letters follow a configurable tone (formal, conversational, enthusiastic) and length (short, standard, detailed).

---

## 7. Master Resume Data Schema

The master resume is stored as structured JSON. Below is the top-level schema definition. Each section contains an array of entries with standardized fields to enable precise LLM processing.

| Field | Type | Description |
|---|---|---|
| `contact` | Object | Name, email, phone, LinkedIn URL, GitHub URL, location, portfolio URL. |
| `summary` | String | A comprehensive professional summary (not tailored — the LLM will rewrite this per JD). |
| `experience[]` | Array | Each entry: company, title, start_date, end_date, location, bullets[] (achievement statements with quantified results where possible). |
| `skills[]` | Array | Each entry: category (e.g., "Languages", "Frameworks"), items[] (individual skill names). Supports proficiency_level (expert/proficient/familiar) as optional metadata. |
| `projects[]` | Array | Each entry: name, description, technologies[], url, highlights[]. Supports both professional and personal projects. |
| `education[]` | Array | Each entry: institution, degree, field, graduation_date, gpa (optional), honours[], coursework[]. |
| `certifications[]` | Array | Each entry: name, issuer, date, expiry_date (optional), credential_id. |
| `metadata` | Object | target_roles[] (preferred role titles), industries[] (preferred industries), preferences (formatting, length, tone defaults). |

---

## 8. API Design

The backend exposes a RESTful API consumed by the web frontend. All endpoints return JSON. Authentication is handled via a simple API key or session token (single-user system).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/tailor` | Accept JD text + tailoring options; return tailored resume. Streams response via SSE for real-time preview. |
| `POST` | `/api/analyze-jd` | Parse a job description and return structured analysis (keywords, requirements, gap report). |
| `GET` | `/api/resume` | Return the current master resume in JSON format. |
| `PUT` | `/api/resume` | Update the master resume (full or partial section update). |
| `POST` | `/api/resume/import` | Upload a PDF/DOCX and parse into structured JSON format. |
| `GET` | `/api/history` | List all generated resumes with filters (date, company, role, model). |
| `GET` | `/api/history/{id}` | Retrieve a specific historical resume with its JD and metadata. |
| `POST` | `/api/history/{id}/retailor` | Re-run tailoring on a historical entry (uses current master resume). |
| `GET` | `/api/export/{id}/{format}` | Download a generated resume as PDF, DOCX, MD, or TXT. |
| `GET` | `/api/models/status` | Health check for all configured LLM endpoints (local, Azure, Gemini). |
| `POST` | `/api/compare` | Run the same JD against two models and return both outputs with a diff. |
| `POST` | `/api/cover-letter` | Generate a cover letter from JD analysis and tailored resume. |

---

## 9. UI/UX Requirements

### 9.1 Design Principles

1. **Mobile-first:** Every screen must be fully usable on a 375px-wide viewport. Desktop is a progressive enhancement.
2. **Speed over polish:** The primary workflow (paste JD → get resume) should require no more than 3 taps/clicks.
3. **Streaming output:** Resume text streams in real-time as the LLM generates it (via SSE), giving immediate feedback.
4. **Offline-capable:** Static assets cached via service worker. History viewable offline. Tailoring requires connectivity.

### 9.2 Key Screens

#### Dashboard (Home)

The primary screen. A large text area for pasting job descriptions, a model selector dropdown, a tailoring intensity toggle (light/moderate/heavy), and a prominent "Tailor" button. Below, a quick-access list of recent generations.

#### Resume Preview

After generation, the tailored resume is displayed in a formatted preview with an ATS score badge. Action buttons for export (PDF/DOCX), edit (inline), copy (plain text), and save to history. A collapsible panel shows the JD analysis (extracted keywords, gap report).

#### History

Searchable, filterable list of all generated resumes. Each entry shows company, role, date, model used, and ATS score. Tap to expand and preview or re-tailor.

#### Master Resume Editor

Section-by-section editor with a form view (structured fields) and a raw JSON view. Supports drag-and-drop reordering of sections and entries. Version history sidebar.

#### Settings

Model configuration (endpoints, API keys), default tailoring preferences, export template selection, and data management (export all data, clear history).

---

## 10. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | End-to-end tailoring completes within 120 seconds (local LLM) or 60 seconds (cloud). UI must remain responsive during generation (streaming). |
| Security | API keys stored in environment variables, never in frontend code. All traffic over HTTPS. Cloudflare Tunnel for local LLM access (no exposed ports). Optional basic auth on the web UI. |
| Privacy | Resume data never leaves the user's infrastructure (local LLM path). Cloud API calls send only the JD + master resume content — no metadata. Option to disable cloud models entirely. |
| Reliability | Automatic failover: if local LLM is unreachable, fallback to Azure. Retry logic with exponential backoff on API failures. Graceful degradation if all models are unavailable. |
| Scalability | Single-user system; no horizontal scaling needed. SQLite is sufficient. Architecture supports easy migration to PostgreSQL if ever needed. |
| Maintainability | Clear separation of concerns (UI / API / intelligence layer). Prompt templates stored as versioned files, not hardcoded. Environment-based configuration for all external dependencies. |
| Portability | Dockerized backend for one-command deployment on any platform. Frontend served as static files from the same container or any CDN. |

---

## 11. Technology Stack Summary

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Fast builds, small bundle, excellent DX. PWA via Workbox. |
| Backend | Python 3.11+ / FastAPI | Async-native, excellent LLM library support, auto-generated API docs. |
| Database | SQLite via SQLModel | Zero-config, file-based, perfect for single-user. Async via aiosqlite. |
| Local LLM | Ollama or LM Studio | OpenAI-compatible API. Run any GGUF model locally. |
| Cloud LLM | Azure AI Foundry (GPT 5.2) | Already provisioned. Enterprise-grade reliability. |
| Validation LLM | Google Gemini API | Cost-effective second opinion. Good at structured analysis. |
| Tunnel | Cloudflare Tunnel (cloudflared) | Free. Secure remote access to local LLM without port forwarding. |
| Deployment | Docker + Azure App Service | Containerized for portability. Free tier for hosting. |
| PDF Export | WeasyPrint or Puppeteer | High-quality PDF rendering from HTML/CSS templates. |
| CI/CD | GitHub Actions | Automated testing and deployment on push. |

---

## 12. Phased Roadmap

### Phase 1 – MVP (Weeks 1–3)

*Goal: End-to-end tailoring via a single model, accessible from a browser.*

- Master resume JSON schema + import from existing PDF/DOCX.
- JD analysis prompt (keyword extraction + structured output).
- Single-model tailoring (local LLM via Ollama).
- FastAPI backend with core endpoints (`/tailor`, `/resume`, `/export`).
- Minimal web UI: paste JD, get tailored resume, export as PDF.
- SQLite history storage.
- Docker container for one-command local deployment.

### Phase 2 – Multi-Model & Mobile (Weeks 4–6)

*Goal: Cloud fallback, model comparison, polished mobile experience.*

- Multi-model router (local → Azure GPT 5.2 failover).
- Gemini API integration for validation/comparison.
- Side-by-side comparison view.
- Cloudflare Tunnel setup for remote access to local LLM.
- Deploy backend to Azure App Service (free tier).
- PWA enhancements (installable, offline history access).
- Streaming output via SSE for real-time preview.

### Phase 3 – Polish & Extras (Weeks 7–8)

*Goal: Cover letters, templates, analytics, and quality-of-life improvements.*

- Cover letter generation.
- Multiple resume templates/layouts.
- ATS compatibility scoring.
- Batch tailoring (multiple JDs in one run).
- History analytics dashboard.
- Master resume version history with rollback.
- Inline post-generation editing.

### Phase 4 – Future Enhancements (Backlog)

- Browser extension to extract JDs directly from job listing pages.
- Email integration: email a JD to a dedicated address, receive tailored resume back.
- LinkedIn profile sync: auto-import profile data into master resume.
- Interview prep mode: generate likely interview questions based on the JD + tailored resume.
- Application tracker: integrate with job boards or a Kanban board for application status.

---

## 13. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| LLM hallucination (fabricated experience) | High | Validation prompt cross-references output against master resume. UI highlights any content not traceable to master resume entries. |
| Local LLM quality insufficient | Medium | Model router provides seamless fallback to GPT 5.2. User can set minimum quality threshold that triggers cloud escalation. |
| Over-optimisation for ATS | Medium | Tailoring prompts include explicit instructions to maintain authenticity and readability. Human review step before export. |
| API cost overruns | Low | Local LLM is primary (free). Cloud usage tracked with monthly budget alerts. Rate limiting on cloud calls. |
| Data privacy concern | Low | Local-first architecture. Cloud calls are opt-in. No data stored on third-party servers beyond the API call itself. |
| Prompt injection via JD | Low | JD input sanitised before prompt construction. System prompts use delimiters and instruction hierarchy to prevent injection. |

---

## 14. Open Questions

1. **Which local LLM model to default to?** Candidates include Llama 3.3 70B (quality) vs. Mistral 7B (speed). Needs benchmarking on resume tailoring quality.
2. **Should the master resume support multiple "profiles"?** (e.g., one for software engineering roles, one for product management). This adds complexity but improves output for career-switchers.
3. **PDF template engine:** WeasyPrint (Python-native, simpler) vs. Puppeteer (higher fidelity, heavier dependency). Needs testing with complex resume layouts.
4. **Should the system auto-detect tailoring intensity** based on the gap analysis, or always require manual selection?
5. **Gemini API:** Worth the added complexity for validation, or is a second GPT 5.2 call sufficient?

---

## 15. Appendix

### 15.1 Glossary

| Term | Definition |
|---|---|
| ATS | Applicant Tracking System – software used by employers to scan and filter resumes. |
| JD | Job Description – the posting/listing describing a role's requirements. |
| Master Resume | A comprehensive, un-tailored resume containing all of the user's experience and skills. |
| SSE | Server-Sent Events – a protocol for streaming data from server to client. |
| PWA | Progressive Web App – a web application installable on a device's home screen. |
| Cloudflare Tunnel | A free service that creates a secure tunnel from the internet to a local machine. |
| GGUF | A model file format used by Ollama, LM Studio, and llama.cpp for running LLMs locally. |

### 15.2 Reference Links

- Ollama documentation: https://ollama.com/docs
- FastAPI documentation: https://fastapi.tiangolo.com
- Cloudflare Tunnel setup: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- Azure App Service free tier: https://azure.microsoft.com/en-us/pricing/details/app-service/
- Azure AI Foundry: https://ai.azure.com
