# Project Memory: Agentic CRM Intelligence Platform

## Iteration 1: Foundation & Setup
- **Goal**: Establish the base directory structure, database models, Docker Compose deployment, backend FastAPI setup, RAG documents, and frontend structure.
- **Timestamp**: 2026-06-11
- **Status**: Completed.

### Core Decisions & Configuration:
1. **Tech Stack**: FastAPI, SQLAlchemy (async/sync), pgvector, Celery, Redis, React, Vite, Tailwind CSS.
2. **Database Engine**: PostgreSQL with `ankane/pgvector` image for integrated vector search.
3. **OpenAI Integration**: Implemented structured outputs and embeddings with robust mock fallback mechanisms when no `OPENAI_API_KEY` is present.
4. **Interactive Dashboard**: Configured View 1 (Inbox List), View 2 (Thread Workspace detailing timeline, agent reasoning trace, RAG similarity references, and draft edits), and View 3 (Analytics with Recharts, volume heatmap, and risk warnings).

### Created Files & Directories:
- `docker-compose.yml`: Multi-container configuration.
- `memory.md`: Log of decisions and changes.
- `backend/Dockerfile`: Backend Docker recipe.
- `backend/requirements.txt`: Python package manager file.
- `backend/seed_kb.py`: CLI seeding tool.
- `backend/app/main.py`: FastAPI application entry point.
- `backend/app/config.py`: Environment configuration mapping.
- `backend/app/db/session.py`: Database engines and session builders.
- `backend/app/db/models.py`: SQLAlchemy models (7 tables + custom performance indexes).
- `backend/app/db/init_db.py`: Database table creator and vector extension enabler.
- `backend/app/schemas/`: Pydantic serializations (email.py, thread.py, contact.py, agent.py).
- `backend/app/services/`: Pipeline code blocks:
  - `heuristics.py`: synchronous checks.
  - `rag.py`: chunking, embedding, vector retrieval.
  - `llm.py`: structured LLM queries.
  - `agent_workflow.py`: autonomous agent loop + 6 tool calls logic.
  - `scraper.py`: reputation scraper and robots.txt check.
- `backend/app/api/endpoints.py`: All 15 endpoints.
- `backend/app/workers/tasks.py`: Celery worker task configuration.
- `knowledge_base/`: 6 Markdown documents defining Standard policies (pricing, SLA, refund, API docs, compliance FAQ, escalation matrix).
- `frontend/Dockerfile`: Frontend Docker recipe.
- `frontend/package.json`: Frontend npm package configuration.
- `frontend/tsconfig.json`: TypeScript configuration.
- `frontend/vite.config.ts`: Vite settings.
- `frontend/tailwind.config.js` & `postcss.config.js`: Tailwind settings.
- `frontend/index.html`: Main HTML entry with custom typography fonts.
- `frontend/src/index.css`: Foundational dark mode CSS styles.
- `frontend/src/main.tsx`: React initialization loader.
- `frontend/src/App.tsx`: Main dashboard coordinator with simulator controls.
- `frontend/src/components/`: Primary views (InboxList.tsx, ThreadWorkspace.tsx, AnalyticsDashboard.tsx).

## Iteration 2: Fixes & Entity Highlighting Updates
- **Goal**: Fix the asyncio event loop mismatch in Celery worker that prevented agent reasoning traces from saving, and update regexes for entity highlighting.
- **Timestamp**: 2026-06-11
- **Status**: Completed.

### Core Changes:
1. **Asyncio Connection Pool Fix**: Resolved `RuntimeError: Task ... got Future ... attached to a different loop` in the Celery worker task (`backend/app/workers/tasks.py`) by explicitly disposing the SQLAlchemy `engine` at the end of each async task (`await engine.dispose()`). This guarantees that successive Celery tasks run on clean event loops with freshly initialized database connection pools.
2. **Entity Highlighting Enhancements**: Updated regular expressions and styling in `ThreadWorkspace.tsx` to:
   - Match and highlight deadlines/dates case-insensitively, supporting variants like "October 1st", "Oct 20", "30-day window", and "48 hours".
   - Highlight ticket and order IDs in blue and green respectively.
   - Underline monetary values (USD and BTC) in amber and red respectively.
