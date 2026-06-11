# CRM Intelligence Platform (Agentic Ops Platform)

An enterprise-ready, AI-powered CRM operations inbox and autonomous agent routing system. It ingests incoming customer emails, clusters them into conversational threads, runs real-time heuristics checks (for spam, internal routing, and security/ransomware escalations), performs structured LLM triage (sentiment analysis, urgency classification, category detection, entity extraction), executes a multi-step autonomous ReAct agent loop with registered tools, and renders it on a premium interactive dark-mode React dashboard.

---

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy (supporting both async/sync operations), pgvector, Celery, Redis
- **AI / LLM Integration**: OpenAI API (with robust deterministic rules-based fallbacks for sandbox environments)
- **Frontend**: React (Vite + TypeScript), TailwindCSS, Lucide-React, Recharts
- **Containerization**: Docker Compose

---

## Key Features

1. **Real-time Ingestion & Heuristics**: Ingests incoming emails via `POST /api/ingest` and runs keyword filters under 10ms to triage spam, internal communications, and immediate threat alerts (e.g., ransomware, extortion).
2. **Autonomous ReAct Agent Loop**: Runs a state machine loop in Celery background workers (up to 6 steps) utilizing registered tools (`get_thread_history`, `search_knowledge_base`, `check_account_status`, `flag_for_legal`, `escalate_to_human`, etc.) to retrieve policy context and draft replies.
3. **RAG-Enhanced Triage**: Injects context chunks retrieved from vector search over local markdown policy documents (e.g., SLA credit regulations, refund playbooks) using pgvector cosine similarity.
4. **Live Web Intelligence Cache**: Scrapes public ratings and complaints from sites like G2, Capterra, and Trustpilot for reputation-sensitive senders, observing `robots.txt` rules and caching results in the database for 6 hours.
5. **Interactive Dashboard Viewports**:
   - **Mission Control Inbox**: A real-time, filterable inbox of incoming customer threads.
   - **Thread Workspace**: A multi-pane viewport displaying chronological timeline emails with highlighted entities (monetary values, dates/deadlines, tickets/orders), contact profile indicators, live web reputation details, interactive collapsible agent reasoning logs, and RAG context.
   - **Business Analytics**: High-quality charts mapping average sentiment trends, category breakdowns, and customer risk statuses.
   - **Simulation Console**: Control panel to inject pre-configured scenarios (e.g., Bob Jones P0 Outage, GDPR portability, Ransomware extortion) or stream the complete `email-data-advanced.json` database.

---

## Getting Started

### Prerequisites
- Docker & Docker Compose installed on your system.

### Build and Launch the Platform
Run the following single command in the root folder of the project to build and launch all containers:
```bash
docker-compose up --build
```

### Access URLs
- **Vite React Frontend**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Backend (Swagger API Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Database Reset & Seeding
The database and vector store will automatically initialize and build tables on startup.
- If you need to wipe transactional tables and reseed vectors from scratch, click the **Reset Database State** button in the bottom right corner of the dashboard console.

---

## Verification & Testing Scenarios

Use the **Simulation Console** (right drawer) to inject test scenarios:
- **Bob Jones SLA Escalation (msg_060)**: Triggers the 6-step agent loop (`get_thread_history` -> `search_knowledge_base` -> `check_account_status` -> `flag_for_legal` -> `draft_reply` -> `escalate_to_human`).
- **GDPR Article 20 Request (msg_052)**: Flagged as compliance, creates an internal ticket, logs a legal flag, and restricts automated replies.
- **Ransomware & Extortion Attack (msg_038)**: Heuristics blocklist detects the ransomware attempt instantly, flags the threat level, and disables auto-replies.
