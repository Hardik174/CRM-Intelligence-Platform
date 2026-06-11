# Implementation Plan - Agentic CRM Intelligence Platform

This document outlines the detailed architecture, database schemas, API designs, folder structures, and implementation phases for the AI-powered CRM Intelligence Platform.

## User Review Required

Please review the architectural choices and design decisions outlined below.

> [!IMPORTANT]
> **Key Architecture Decisions:**
> 1. **pgvector Integration**: We will use the `ankane/pgvector` PostgreSQL image to support vector embeddings directly in the database.
> 2. **Celery + Redis**: Background processing of emails will be handled asynchronously using Celery and Redis. This keeps the `/api/ingest` endpoint extremely fast and responsive.
> 3. **OpenAI Mock Fallbacks**: To allow the system to run out-of-the-box without an active `OPENAI_API_KEY`, we will implement simulated mock LLM responses and mock embeddings as a fallback. If a key is present in the environment, the system will use the real OpenAI API.
> 4. **Robots.txt Scraping Guard**: The reputation scraper will check robots.txt compliance before hitting domains on-demand. If forbidden or if the network request fails, it will fail gracefully and let the agent proceed.

## Open Questions

> [!WARNING]
> Do we want to support any other vector database besides pgvector, or should pgvector be the sole vector store? (We propose pgvector for maximum cohesion and minimum resource usage in the Docker Compose environment).

---

## Proposed Changes

We will organize the project into a clean, decoupled structure containing a backend FastAPI application, database migration tools, Markdown knowledge files, and a Vite-based TypeScript React frontend.

### Component Layout (Complete Folder Structure)

We propose the following directory tree:
```
SenAI Project Assignment/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI app initialization & routing
│   │   ├── config.py              # Settings via pydantic-settings
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── session.py         # SQLAlchemy async & sync session managers
│   │   │   └── models.py          # SQLAlchemy models
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── email.py           # Pydantic schemas for email ingestion & responses
│   │   │   ├── thread.py          # Pydantic schemas for threads & timelines
│   │   │   ├── contact.py         # Pydantic schemas for contact profiles
│   │   │   └── agent.py           # Pydantic schemas for agent logs
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── ingestion.py       # Email ingestion, validation, and de-duplication
│   │   │   ├── heuristics.py      # Synchronous keyword-based pre-filtering
│   │   │   ├── rag.py             # Knowledge chunking, embedding, and retrieval
│   │   │   ├── llm.py             # OpenAI classification wrapper (structured JSON)
│   │   │   ├── agent_workflow.py  # LangGraph / state machine autonomous agent loop
│   │   │   ├── scraper.py         # Reputation and pricing scraper (G2/Trustpilot cache)
│   │   │   └── audit.py           # Audit logging helpers
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── endpoints.py       # FastAPI router implementations
│   │   └── workers/
│   │       ├── __init__.py
│   │       └── tasks.py           # Celery tasks for async email triage
│   ├── alembic/                   # Database migrations configuration
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── Dockerfile                 # Multi-stage production build for backend
│   ├── requirements.txt           # Python backend dependencies
│   └── seed_kb.py                 # CLI tool to chunk & embed knowledge base files
├── frontend/
│   ├── src/
│   │   ├── components/            # UI components (shadcn/ui inspired)
│   │   │   ├── InboxList.tsx
│   │   │   ├── ThreadWorkspace.tsx
│   │   │   └── AnalyticsDashboard.tsx
│   │   ├── views/                 # Top level views
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── index.html
├── knowledge_base/
│   ├── pricing_policy.md          # KB source docs
│   ├── sla_policy.md
│   ├── refund_policy.md
│   ├── api_docs.md
│   ├── compliance_faq.md
│   └── escalation_matrix.md
├── docker-compose.yml             # Single-command environment orchestration
└── README.md                      # Comprehensive developer setup & architecture docs
```

---

### Database Schema Design

#### [NEW] [models.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/db/models.py)

We will implement SQLAlchemy models mapping directly to the 7 required tables:

1. **`contacts`**:
   - `id`: integer/UUID (Primary Key)
   - `email`: string (unique index)
   - `name`: string
   - `company`: string
   - `status`: string (Enum: `VIP`, `Blocked`, `Active`, `Churned`)
   - `account_value`: numeric
   - `churn_risk_score`: float
   - `created_at`: timestamp
   - `last_contact_at`: timestamp

2. **`threads`**:
   - `id`: integer (Primary Key)
   - `thread_id`: string (unique index)
   - `subject`: string
   - `sender_email`: string (foreign key to `contacts.email` or indexed)
   - `first_seen_at`: timestamp
   - `last_updated_at`: timestamp
   - `status`: string (Enum: `Open`, `Resolved`, `Escalated`, `Ignored`)
   - `assigned_to`: string

3. **`emails`**:
   - `id`: integer (Primary Key)
   - `thread_id`: string (foreign key to `threads.thread_id`, indexed)
   - `message_id`: string (unique index)
   - `sender`: string (indexed)
   - `subject`: string
   - `body`: text
   - `timestamp`: timestamp
   - `sentiment_score`: float
   - `category`: string (Enum)
   - `urgency`: string (Enum: `Critical`, `High`, `Medium`, `Low`)
   - `requires_human`: boolean
   - `confidence`: float
   - `raw_entities`: JSONB (order_ids, ticket_ids, monetary_amounts, deadlines, products)
   - `status`: string (Enum: `Received`, `Processing`, `Replied`, `Escalated`, `Ignored`)

4. **`actions`**:
   - `id`: integer (Primary Key)
   - `email_id`: integer (foreign key to `emails.id`, indexed)
   - `agent_reasoning_log`: JSONB (Thought -> Action -> Observation steps)
   - `action_type`: string (Enum: `Auto-Reply`, `Escalate`, `Legal-Flag`, `Ticket-Created`, `Ignored`)
   - `proposed_content`: text
   - `is_approved`: boolean
   - `approved_by`: string
   - `executed_at`: timestamp

5. **`knowledge_chunks`**:
   - `id`: integer (Primary Key)
   - `source_doc`: string
   - `chunk_text`: text
   - `embedding`: Vector(1536) (pgvector type for OpenAI `text-embedding-3-small` or `text-embedding-ada-002`)
   - `created_at`: timestamp

6. **`web_intelligence_cache`**:
   - `id`: integer (Primary Key)
   - `source_url`: string (indexed)
   - `target_entity`: string (indexed)
   - `scraped_data`: JSONB
   - `scraped_at`: timestamp
   - `expires_at`: timestamp (indexed)

7. **`audit_log`**:
   - `id`: integer (Primary Key)
   - `entity_type`: string (e.g., 'emails', 'contacts', 'threads')
   - `entity_id`: string/integer
   - `action`: string
   - `performed_by`: string ('agent' or user identifier)
   - `timestamp`: timestamp
   - `diff`: JSONB

---

### Backend Architecture

The backend FastAPI app will orchestrate components:
- **Heuristics Layer**: Instantly checks keyword lists to flag spam, security threats, or internal mail, and assigns priority.
- **Ingestion**: Accepts incoming POST requests, saves raw email payloads, ensures idempotency on `message_id`, and initiates a Celery task.
- **RAG Service**: Integrates with OpenAI API for embeddings. Retrieves top-3 relevant documents via pgvector cosine distance:
  `SELECT chunk_text, similarity FROM ... ORDER BY embedding <=> :query_embedding LIMIT 3`.
- **Classification Engine**: Structured JSON query utilizing OpenAI GPT model. The prompt binds context chunks, sentiment, urgency guidelines, and outputs the exact requested schema.
- **Agent Workflow**: A state machine that sequentially executes reasoning steps. Each iteration selects a tool (e.g. `search_knowledge_base`, `get_thread_history`), records the observation, and completes with a final response or escalation action.
- **Web scraping**: A crawler to check Robots.txt, fetch public review sentiment, G2/Trustpilot metrics, or pricing pages asynchronously.

---

### Docker Compose Configuration

#### [NEW] [docker-compose.yml](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/docker-compose.yml)

We will set up 5 containers:
1. **`db`**: Image `ankane/pgvector:latest` with postgres username, password, database.
2. **`redis`**: Image `redis:alpine` serving as Celery broker.
3. **`backend`**: FastAPI application container running uvicorn on port `8000`.
4. **`celery_worker`**: Celery worker running background task queues.
5. **`frontend`**: Vite static files server on port `5173`.

---

## Verification Plan

### Automated Tests
We will write automated test scripts in backend/app/tests to verify:
- Idempotent ingestion (multiple POST requests with identical `message_id`).
- Heuristic pre-filters (detecting spam or security threats immediately).
- RAG search accuracy (testing search terms and comparing similarity scores).
- Agent execution dry-run and tool limit.

### Manual Verification
1. **E2E Demo Replay**: Execute a replay script that streams the `email-data-advanced.json` file via POST `/api/ingest` at a rate of 1 email/second.
2. **Dashboard Interactive QA**: View the processed emails in the dashboard, checking:
   - Bob Jones P0 Outage Escalation thread (which flags a legal threat, pulls SLA details, and generates a ticket).
   - Karen's refund threat showing scraped rating info.
   - GDPR portability request flagging for legal review.
   - Live analytics metrics updating.
