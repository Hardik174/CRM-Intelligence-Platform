# Implementation Plan - Bonus Challenges

This plan outlines the architecture, database changes, and implementation details for completing the five remaining and partially covered bonus challenges for the CRM Intelligence Platform.

## Features to Implement

1. **Real-time WebSocket Streaming**
   - Push new email events and agent decisions to the frontend in real time using a Redis Pub/Sub backend listener and FastAPI WebSockets.
2. **Multi-agent Architecture**
   - Refactor `agent_workflow.py` to route tasks through three specialized sub-agents: *Classifier Agent*, *Research Agent*, and *Reply Agent*, orchestrated by a *Coordinator Agent*.
3. **Human-in-the-Loop Fine-tuning Data Export**
   - Create an API endpoint (`GET /analytics/fine-tuning-pairs`) to retrieve human-edited/approved drafts formatted as standard OpenAI fine-tuning messages, and add a download button in the frontend.
4. **Email Thread Summarization**
   - Auto-generate a 3-sentence executive summary for threads containing 5+ emails, save it to the database, and display it in a styled AI banner in the Workspace view.
5. **Dynamic Churn Prediction Score Model**
   - Compute the churn risk dynamically when new emails are ingested by analyzing rolling sentiment trends, unanswered email times, and category histories.

---

## Proposed Changes

### 1. Database Model Updates

#### [MODIFY] [models.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI Project Assignment/backend/app/db/models.py)
- Add a new column `summary` (TEXT) to the `Thread` model to cache the 3-sentence executive summaries.
- Ensure new database migrations are compiled to support this column.

---

### 2. Backend Services & Routing

#### [MODIFY] [endpoints.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI Project Assignment/backend/app/api/endpoints.py)
- **WebSocket Route**: Add `@router.websocket("/ws")`. Manage active WebSocket connections using a connection manager.
- **Redis Pub/Sub Listener**: Run a background task on startup to listen to a Redis channel `crm_events`. When a message is published (e.g. from Celery workers), broadcast it to all connected WebSockets.
- **Fine-tuning Export Endpoint**: Add `GET /analytics/fine-tuning-pairs` which searches `audit_logs` for `EDIT_DRAFT` and `APPROVE_DRAFT` actions and constructs standard OpenAI fine-tuning JSON.

#### [MODIFY] [agent_workflow.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI Project Assignment/backend/app/services/agent_workflow.py)
- Refactor the agent execution loop into specialized sub-agents:
  - **Classifier Agent**: Analyzes intent, urgency, sentiment.
  - **Research Agent**: Fetches historical emails and queries pgvector.
  - **Reply Agent**: Generates proposed draft replies and escalation routing.
  - **Coordinator Agent**: Oversees flow, tool invocation, and logs logs representing the multi-agent roles.
- Check if thread has 5+ emails. If yes, generate and save the 3-sentence thread summary to `thread.summary`.
- Trigger Redis Pub/Sub events when triage completes, publishing a message on `crm_events`.

#### [MODIFY] [ingestion.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI Project Assignment/backend/app/services/ingestion.py)
- Implement `calculate_dynamic_churn_risk(db, contact, current_email)`:
  - Calculate rolling sentiment score of the last 3 emails.
  - Count unanswered emails and check elapsed time since last customer email.
  - Set risk weights based on category history (e.g., security, billing, compliance boost risk).
  - Update `contact.churn_risk_score` in the database.
- Trigger Redis Pub/Sub events upon email ingestion.

#### [MODIFY] [tasks.py](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI Project Assignment/backend/app/workers/tasks.py)
- Ensure background worker publishes events to the Redis channel when tasks complete, letting the main server broadcast them to WebSockets.

---

### 3. Frontend Dashboard Updates

#### [MODIFY] [App.tsx](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI Project Assignment/frontend/src/App.tsx)
- Establish a WebSocket connection (`new WebSocket("ws://localhost:8000/ws")`) on mount.
- On receiving events (e.g., `EMAIL_INGESTED`, `ACTION_COMPLETED`), dynamically trigger dashboard statistical and threads list updates.

#### [MODIFY] [ThreadWorkspace.tsx](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI Project Assignment/frontend/src/components/ThreadWorkspace.tsx)
- If `activeThread.summary` is populated, display a styled glassmorphic AI executive summary banner at the top of the Timeline pane.
- Display multi-agent tags in the Reasoning Trace steps (e.g., `[Classifier Agent]`, `[Research Agent]`, etc.).

#### [MODIFY] [AnalyticsDashboard.tsx](file:///c:/Users/Hardik%20Rokde/Downloads/SenAI Project Assignment/frontend/src/components/AnalyticsDashboard.tsx)
- Add a "Download Fine-tuning Dataset" button under the analytics view to fetch the exported JSON training pairs.

---

## Verification Plan

### Automated & Manual Verification
1. **WebSocket Test**: Open console logs on the frontend, inject emails, and verify that the inbox updates instantly without polling network requests.
2. **Multi-Agent Verification**: Inject Bob Jones escalation and check the Agent Reasoning Trace to see the coordinator handing off to Classifier, Research, and Reply sub-agents.
3. **Summarization Test**: Inject a thread containing 5+ emails (e.g. by repeatedly sending follow-ups), and verify that a 3-sentence summary banner displays at the top of the timeline.
4. **Dynamic Churn Prediction Test**: Send several consecutive highly negative emails and check if the customer churn risk score dynamically spikes in the contact profile card.
5. **Fine-Tuning Data Test**: Edit a draft, approve it, and hit `GET /analytics/fine-tuning-pairs` to verify the generated fine-tuning schema is correct.
