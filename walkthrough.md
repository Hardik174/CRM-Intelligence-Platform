# Project Walkthrough: CRM Intelligence Platform

I have successfully bootstrapped and implemented the full architecture of the production-grade **AI-powered CRM Intelligence Platform**.

Here is a summary of the components and files created:

## Core Components Built

### 1. Project Docker Environment
- [docker-compose.yml](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/docker-compose.yml): Coordinates PostgreSQL (`ankane/pgvector` image), Redis (as the broker), FastAPI backend, Celery background worker, and Vite React frontend.
- [backend/Dockerfile](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/Dockerfile): Container setup for Python dependencies.
- [frontend/Dockerfile](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/frontend/Dockerfile): Container setup for the React + Vite frontend environment.

### 2. Database Layer
- [backend/app/db/models.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/db/models.py): Defines the 7 relational tables with indexes, foreign keys, JSONB parameters, and `Vector(1536)` embedding types.
- [backend/app/db/session.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/db/session.py): Async and Sync connection engines.
- [backend/app/db/init_db.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/db/init_db.py): Runs `CREATE EXTENSION IF NOT EXISTS vector;` and initializes all tables on startup.

### 3. Real-Time Ingestion & Heuristics
- [backend/app/services/heuristics.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/services/heuristics.py): Processes emails in under 10ms to check keyword blocklists (spam), security threats, and company internal email filters.
- [backend/app/services/ingestion.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/services/ingestion.py): Handles transaction safety, links incoming message IDs to threads, creates CRM contact profiles dynamically, and schedules async Celery tasks.

### 4. RAG Knowledge Pipeline
- The 6 policy documents in `knowledge_base/` ([pricing_policy.md](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/knowledge_base/pricing_policy.md), [sla_policy.md](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/knowledge_base/sla_policy.md), [refund_policy.md](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/knowledge_base/refund_policy.md), [api_docs.md](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/knowledge_base/api_docs.md), [compliance_faq.md](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/knowledge_base/compliance_faq.md), [escalation_matrix.md](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/knowledge_base/escalation_matrix.md)).
- [backend/app/services/rag.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/services/rag.py): Chunking (350 words) with overlap, vector embeddings generation (using real OpenAI embeddings or deterministic mock embeddings for sandbox testing), and vector cosine similarity search.

### 5. Multi-Layer AI & Agent Loop
- [backend/app/services/llm.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/services/llm.py): Structured JSON parser that triages category, urgency, sentiment, entities, and requires_human escalation rules.
- [backend/app/services/agent_workflow.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/services/agent_workflow.py): Autonomous ReAct/CoT loop executing up to 6 steps. Includes database actions recording (Thought -> Action -> Observation) and routing triggers.
- [backend/app/services/scraper.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/services/scraper.py): Web sentiment intelligence scraper with robots.txt enforcement and a 6-hour database caching interval.

### 6. Background Tasks & REST APIs
- [backend/app/workers/tasks.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/workers/tasks.py): Celery async worker setup.
- [backend/app/api/endpoints.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/api/endpoints.py): Implementation of all 15 endpoints (e.g. status tracking, thread details, draft revisions, approvals, analytics, and audit logging).

### 7. Interactive Frontend Portal
- Built a multi-pane Vite React layout in [frontend/src/App.tsx](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/frontend/src/App.tsx):
  1. **View 1: Mission Control Inbox**: Filterable grid displaying thread lists, urgency scores, and sentiment indicators ([InboxList.tsx](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/frontend/src/components/InboxList.tsx)).
  2. **View 2: Thread Workspace**: Detailed workspace showcasing entity-highlighted email text, interactive agent reasoning logs, RAG references, and draft editor actions ([ThreadWorkspace.tsx](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/frontend/src/components/ThreadWorkspace.tsx)).
  3. **View 3: Business Analytics**: Recharts sentiment logs, volume heatmap matrices, and at-risk churn warnings ([AnalyticsDashboard.tsx](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/frontend/src/components/AnalyticsDashboard.tsx)).
  4. **Simulation Dashboard (Aside)**: Control deck where developers can upload `email-data-advanced.json` files for ingestion simulation, trigger single preset test scenarios (e.g. Bob's outage escalation), or perform database flushes.

---

## How to Run the Environment

### Complete Startup Command:
Run the following in the root folder of the project to build and launch all containers:
```bash
docker-compose up --build
```

### Access Ports:
- **FastAPI Web Service**: [http://localhost:8000](http://localhost:8000) (Interactive Swagger documentation available at `/docs`)
- **Vite React Frontend**: [http://localhost:5173](http://localhost:5173)

---

## Iteration 2 Updates

### 1. Celery Worker Event Loop & Connection Pool Fix
The asynchronous email agent loop was previously failing to save or retrieve agent reasoning logs on subsequent runs, throwing a `RuntimeError: Task ... got Future ... attached to a different loop`. This was caused by the global SQLAlchemy `engine` caching database connection pools across successive event loops instantiated by Celery's sync worker thread via `asyncio.run()`.
- **Resolution**: Updated [tasks.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/backend/app/workers/tasks.py) to dispose of the engine's connection pool via `await engine.dispose()` inside a `finally` block of the `async_process_email` helper. This ensures that every Celery task execution gets a fresh, clean database connection pool bound to its current event loop.

### 2. Entity Highlighting Enhancements
Improved how the dashboard parses and displays highlighted and underlined entities in emails inside [ThreadWorkspace.tsx](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI%20Project%20Assignment/frontend/src/components/ThreadWorkspace.tsx):
- **Deadlines/Dates (Purple)**: Upgraded regex patterns to support full case-insensitive month names, ordinals, and duration windows (e.g. `October 1st`, `Oct 20`, `30-day statutory window`, `48 hours`).
- **Monetary Values (Amber/Red Underline)**: Styled USD (e.g. `$10,000`) and BTC (e.g. `2 BTC`) to be styled with high-contrast underlines matching the project specification.
- **Ticket/Order IDs (Blue/Green)**: Formatted tickets (e.g. `ticket #11042`) and orders (e.g. `Order #88271`) to be highlighted in blue and green respectively.
