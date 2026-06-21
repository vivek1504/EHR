<div align="center">

# EHR Annotation Platform

**AI-powered clinical NLP backend for medical entity extraction and annotation**

Built with **Hono** · **TypeScript** · **PostgreSQL** · **Prisma** · **Groq LLM**

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.6-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)

</div>

---

## Overview

A production-grade REST API backend for an **Electronic Health Record (EHR) Annotation Platform** — a clinical NLP tool that:

- **Ingests** raw clinical notes (discharge summaries, visit notes)
- **Automatically extracts** medical entities using LLM inference (Groq / Llama-3.3-70b)
- **Classifies** entities into 4 medical categories with character-level offsets
- **Enables** clinicians to review, accept, reject, or correct AI-suggested annotations
- **Tracks** the complete processing lifecycle with audit logging

This system is designed as a **human-in-the-loop AI annotation tool** for healthcare NLP training data generation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Frontend)                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS + X-API-Key
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Hono HTTP Server                            │
│                                                                 │
│  Middleware Stack:                                               │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌────────────┐ ┌────────────┐  │
│  │RequestID │→│Logger│→│ CORS │→│ErrorHandler│→│RateLimiter │  │
│  └──────────┘ └──────┘ └──────┘ └────────────┘ └────────────┘  │
│                                                                 │
│  Routes:                                                        │
│  ┌────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │  /health       │ │  /documents      │ │  /annotations    │   │
│  │  (no auth)     │ │  (API key auth)  │ │  (API key auth)  │   │
│  └────────────────┘ └──────────────────┘ └──────────────────┘   │
│  ┌────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │  /users        │ │  /jobs           │ │  /internal       │   │
│  │  (admin only)  │ │  (API key auth)  │ │  (worker tasks)  │   │
│  └────────────────┘ └──────────────────┘ └──────────────────┘   │
└─────────┬───────────────────┬───────────────────┬───────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│   PostgreSQL    │ │  File Storage   │ │     Groq LLM        │
│   (Prisma ORM)  │ │  (Local / GCS)  │ │  (Llama-3.3-70b)   │
│                 │ │                 │ │                     │
│  • Users        │ │  Clinical note  │ │  Medical entity     │
│  • Documents    │ │  .txt files     │ │  extraction with    │
│  • Annotations  │ │                 │ │  Zod validation     │
│  • Jobs         │ │                 │ │                     │
│  • AuditLog     │ │                 │ │                     │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
```

### AI Analysis Pipeline

```
 Document Upload                    LLM Processing
 ──────────────                    ──────────────
                                   
 ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 │  Upload  │────▶│  Store   │────▶│  Queue   │────▶│  Fetch   │
 │  Text    │     │  to Disk │     │  Job     │     │  Text    │
 └──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                          │
                                                          ▼
 ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 │  Update  │◀────│  Batch   │◀────│ Validate │◀────│  Call    │
 │  Status  │     │  Insert  │     │  (Zod)   │     │  Groq    │
 └──────────┘     └──────────┘     └──────────┘     └──────────┘
                       │                                  │
                       │           ┌──────────┐           │
                       └──────────▶│ Calculate │◀──────────┘
                                   │ Offsets   │
                                   └──────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Language** | TypeScript 6.0 (strict mode) | Type safety |
| **Framework** | Hono 4.6 | Lightweight, fast HTTP framework |
| **Database** | PostgreSQL 15 | Relational data storage |
| **ORM** | Prisma 7.8 | Type-safe database access + migrations |
| **Validation** | Zod 3.25 | Schema validation for all inputs + LLM outputs |
| **AI/LLM** | Groq (Llama-3.3-70b) | Medical entity extraction |
| **Container** | Docker (multi-stage) | Portable deployment |
---

### Medical Entity Labels

| Enum Value | Description | Examples |
|:-----------|:------------|:---------|
| `CLINICAL_CONDITION` | Diseases, disorders, syndromes | hypertension, atrial fibrillation, pericarditis |
| `MEDICATION_STATEMENT` | Drugs, dosages, prescriptions | atorvastatin 40mg, metoprolol 50mg, aspirin 81mg |
| `CLINICAL_FINDING` | Symptoms, signs, vital signs, lab results | chest pain, ST elevation, ejection fraction 35% |
| `MEDICAL_PROCEDURE` | Tests, surgeries, therapies, examinations | ECG, cardiac catheterization, echocardiogram |

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** 15+ (or Docker)
- **Groq API Key** — [Get one free](https://console.groq.com/) (optional — the API works without it, but LLM analysis won't extract entities)

### 1. Clone & Install

```bash
git clone https://github.com/vivek1504/EHR.git
cd EHR
npm install
```

### 2. Start PostgreSQL

**Option A — Docker (recommended):**
```bash
docker compose up db -d
```

**Option B — Local PostgreSQL:**
```bash
# Make sure PostgreSQL is running on localhost:5432
createdb ehr_dev
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env — set your DATABASE_URL and GROQ_API_KEY
```

### 4. Run Migrations & Generate Prisma Client

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Seed the Database

```bash
npm run seed
```

This creates:
- **2 users** — admin (`admin@ehr.local`) and annotator (`annotator@ehr.local`)
- **5 clinical notes** — cardiac patient visit records
- **API keys** — printed to console, use the admin key for testing

### 6. Start the Server

```bash
npm run dev
```

```
  EHR Backend → http://localhost:3000

```

### 7. Test It

```bash
# Health check (no auth)
curl http://localhost:3000/health

# List documents (requires API key)
curl -H "X-API-Key: <your-admin-api-key>" http://localhost:3000/documents

# Trigger AI analysis on a document
curl -X POST -H "X-API-Key: <your-admin-api-key>" http://localhost:3000/documents/doc-001/analyze
```

---

## API Reference

All authenticated routes require the `X-API-Key` header.

### Health

| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/health` | None | Health check — returns server status and DB connectivity |
| `GET` | `/health/ready` | None | Readiness probe — returns 503 if DB is unreachable |

### Documents

| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/documents` | API Key | List documents with filtering and pagination |
| `GET` | `/documents/:id` | API Key | Get document with full text, annotations, and latest job |
| `POST` | `/documents` | API Key | Create a new document (with SHA-256 deduplication) |
| `DELETE` | `/documents/:id` | API Key | Soft delete (admin or owner only) |
| `POST` | `/documents/:id/analyze` | API Key | Trigger LLM analysis |

**Query parameters for `GET /documents`:**

| Param | Type | Example | Description |
|:------|:-----|:--------|:------------|
| `status` | enum | `READY_FOR_REVIEW` | Filter by document status |
| `category` | string | `Cardiac` | Filter by category |
| `page` | int | `1` | Page number (default: 1) |
| `limit` | int | `20` | Items per page (default: 20, max: 100) |

### Annotations

| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/annotations?documentId=<uuid>` | API Key | List annotations with optional filters |
| `POST` | `/annotations` | API Key | Create an annotation (human or LLM) |
| `PATCH` | `/annotations/:id` | API Key | Update status, label, or text |
| `POST` | `/annotations/bulk-accept` | API Key | Accept multiple annotations at once |
| `DELETE` | `/annotations/:id` | API Key | Hard delete an annotation |

**Query parameters for `GET /annotations`:**

| Param | Type | Example | Description |
|:------|:-----|:--------|:------------|
| `documentId` | uuid | `doc-001` | **Required** — filter by document |
| `source` | enum | `LLM` | Filter by source (`HUMAN` or `LLM`) |
| `status` | enum | `SUGGESTED` | Filter by status |

### Users

| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/users` | Admin | List all users with stats |
| `POST` | `/users` | Admin | Create a new user |
| `POST` | `/users/:id/rotate-key` | Admin/Self | Generate new API key |

### Jobs

| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/documents/:id/jobs` | API Key | List processing jobs for a document |
| `GET` | `/jobs/:id` | API Key | Get a single job by ID |

### Internal (Worker)

| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `POST` | `/internal/worker/analyze` | Internal | Cloud Tasks analysis callback |
| `POST` | `/internal/eventarc/gcs` | Internal | Eventarc GCS upload event handler |

---

## Project Structure

```
src/
├── app.ts                    # Hono app factory — middleware + route mounting
├── server.ts                 # HTTP server entry point (@hono/node-server)
│
├── config/
│   ├── index.ts              # Zod-validated environment config
│   └── labels.ts             # Medical entity label constants + mapping
│
├── db/
│   └── client.ts             # Prisma client singleton
│
├── routes/
│   ├── healthRoutes.ts       # GET /health, GET /health/ready
│   ├── documentRoutes.ts     # Document CRUD + analysis trigger
│   ├── annotationRoutes.ts   # Annotation CRUD + bulk operations
│   ├── jobRoutes.ts          # Processing job queries
│   ├── userRoutes.ts         # User management + key rotation
│   └── workerRoutes.ts       # Internal Cloud Tasks / Eventarc endpoints
│
├── middleware/
│   ├── auth.ts               # API key validation + RBAC (with 5-min cache)
│   ├── errorHandler.ts       # Global error → structured JSON response
│   ├── requestId.ts          # X-Request-ID generation for tracing
│   ├── rateLimiter.ts        # In-memory sliding-window rate limiter
│   └── audit.ts              # Mutation audit logging (fire-and-forget)
│
├── lib/
│   ├── ai.ts                 # Groq LLM client — entity extraction + Zod validation
│   ├── storage.ts            # Storage abstraction (local FS / GCS)
│   ├── tasks.ts              # Cloud Tasks dispatch helper
│   ├── eventarc.ts           # Eventarc CloudEvents payload parser
│   └── monitoring.ts         # Structured JSON logger (Cloud Logging compatible)
│
├── jobs/
│   ├── analyzeDocument.ts    # Full pipeline: fetch → LLM → validate → write
│   └── retryFailed.ts        # Retry handler for failed processing jobs
│
├── utils/
│   ├── errors.ts             # Custom error classes (NotFound, Validation, etc.)
│   ├── hash.ts               # SHA-256 hashing for document deduplication
│   └── offsetCalculator.ts   # Regex-based text offset recalculation
│
├── types/
│   ├── index.ts              # Zod schemas for all API request/response payloads
│   └── env.d.ts              # Hono context variable type declarations
│
└── scripts/
    ├── seed.ts               # Database seeding (users + clinical notes)
    └── notes.json            # 5 sample cardiac clinical notes
```

---

## Key Design Decisions

### Why Hono over Express?

Hono is TypeScript-first, has built-in middleware (CORS, logger), supports Web Standard APIs, and runs natively on Cloud Run without adapters. Express would require `@types/express` and more boilerplate for the same functionality.

### Why Zod validation on LLM output?

LLMs return unstructured text. Our pipeline validates this LLM response against a strict Zod schema before writing anything to the database. Invalid responses throw cleanly instead of corrupting data.

### Idempotent Analysis

Re-triggering analysis on a document is safe. The pipeline deletes all existing `LLM`-sourced annotations before inserting new ones, inside a database transaction. Human annotations (`source: HUMAN`) are never touched. This means you can re-run analysis after model upgrades or prompt changes without data duplication.

### SHA-256 Document Deduplication

On upload, the document text is hashed with SHA-256. If a document with the same hash already exists, the upload is rejected with a `409 Conflict` pointing to the existing document. This prevents wasted LLM compute on duplicate clinical notes.

---

## Authentication & Authorization

### API Key Authentication

Every authenticated request must include an `X-API-Key` header. The key is looked up against `User.apiKey` in the database (indexed for O(1) lookups) with a **5-minute in-memory cache** to avoid repeated DB queries.

```bash
curl -H "X-API-Key: your-api-key-here" http://localhost:3000/documents
```

### Role-Based Access Control (RBAC)

| Role | Documents | Annotations | Users |
|:-----|:----------|:------------|:------|
| **VIEWER** | Read | Read | — |
| **ANNOTATOR** | Read, Create | Read, Create, Update own | — |
| **REVIEWER** | Read, Create | Read, Create, Update all, Bulk accept | — |
| **ADMIN** | Full CRUD | Full CRUD | Full CRUD |

### Audit Logging

All state mutations (create, update, delete) are logged to the `AuditLog` table with:
- **Who** — userId
- **What** — action enum (`DOCUMENT_UPLOADED`, `ANNOTATION_UPDATED`, etc.)
- **Which entity** — entityType + entityId
- **What changed** — JSON metadata with old/new values
- **When** — timestamp
- **Where** — IP address

---

## Available Scripts

| Command | Description |
|:--------|:------------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run lint` | Type check (`tsc --noEmit`) |
| `npm run seed` | Seed database with users + clinical notes |
| `npm run cleanup` | Delete all data from database + local storage |
| `npm run db:migrate` | Create a new Prisma migration |
| `npm run db:push` | Apply migrations to database |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:generate` | Regenerate Prisma client |

---

## Docker

### Build

```bash
docker build -t ehr-api .
```

The Dockerfile uses a multi-stage build:
1. **Base** — install dependencies
2. **Build** — compile TypeScript + generate Prisma client
3. **Production** — lean Alpine image with only runtime files

### Run with Docker Compose

```bash
# Start PostgreSQL
docker compose up db -d

# Or start everything
docker compose up
```

---

## Environment Variables

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `GROQ_API_KEY` | No | — | Groq API key for LLM analysis |
| `AI_PROVIDER` | No | `groq` | AI provider (`groq` or `vertex`) |
| `GCS_EMULATOR` | No | `true` | Use local filesystem instead of GCS |
| `STORAGE_PATH` | No | `./data/documents` | Local file storage path |
| `CLOUD_TASKS_ENABLED` | No | `false` | Enable async processing via Cloud Tasks |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin |
| `GCP_PROJECT_ID` | No | — | GCP project (production) |
| `GCP_REGION` | No | `asia-south1` | GCP region (production) |

---

## GCP Production Architecture (Planned)

```
GitHub Actions ──▶ Workload Identity Federation ──▶ Cloud Build ──▶ Artifact Registry
                                                                         │
                                                                         ▼
Client ──▶ Cloud Armor (DDoS) ──▶ Cloud Run (Hono API + Worker)
                                       │         │         │
                                       ▼         ▼         ▼
                                  Cloud SQL   Cloud     Cloud Tasks
                                 PostgreSQL  Storage   (Annotation Queue)
                                              │              │
                                              ▼              │
                                          Eventarc ──────────┘
                                   (GCS ObjectFinalized)
```

| GCP Service | Replaces (AWS) | Purpose |
|:------------|:---------------|:--------|
| Cloud Run | Lambda | Container-based serverless API |
| Cloud SQL | DynamoDB | PostgreSQL with Prisma ORM |
| Cloud Storage | S3 | Clinical note file storage |
| Cloud Tasks | SQS | Reliable async task dispatch |
| Eventarc | EventBridge | GCS upload → task trigger |
| Secret Manager | Env vars | Secure secret storage |
| Cloud Armor | API Gateway throttling | L7 DDoS protection + rate limiting |
| Cloud Build | GitHub Actions build step | Docker image build + deploy |
| Artifact Registry | — | Docker image storage |
| Workload Identity Federation | GitHub OIDC | Zero-credential CI/CD auth |

---

