# Molly Architecture Redesign: Phase 2
## Integrated System Architecture Overview

This document outlines the end-to-end redesign of Molly's architecture, integrating Request Routing, Voice, Periodicals, and Advanced State Management.

### 1. System Architecture Diagram (Text Representation)

```text
[User Interfaces]
      │
      ▼
[Gateway/API (OpenClaw)]
      │
      ▼
[Router (Classifier Tier)] ◄────► [Fast Cache (Redis/SQLite)]
      │
      ├─► [Fast Tier (Groq Llama 3/Gemini Flash)]  (Low complexity/latency)
      ├─► [Slow Tier (Claude 3.5 Sonnet/GPT-4o)]   (High complexity/reasoning)
      └─► [Voice Tier (Gemini Live API)]           (Low latency voice-to-voice)
              │
              ▼
[Unified Memory Orchestrator (MollyGraph)]
      │
      ├─► [Context Builder] ◄───► [Neo4j (Entity Knowledge)]
      │                             └─► [Qdrant (Semantic Search)]
      ├─► [Fast Context] (Voice) ──► [Pre-loaded 2M Context Window]
      └─► [User Model Manager] ◄──► [User Profile (JSON/SQLite)]
              ▲
              │
[Periodicals System (The Heartbeat)]
      │
      ├─► [Cron Engine] ────► [Scheduled Tasks (Daily/Weekly Reflection)]
      └─► [Proactive Loop] ──► [Notification/Action Triggers]
```

### 2. Request Flow & Data Paths

#### 2.1 Text Request (User → Response)
1. **User Query** arrives via Telegram/iMessage/Web.
2. **Router** classifies intent and complexity:
   - *Casual/Informational:* Fast Tier.
   - *Analytical/Complex:* Slow Tier.
3. **MollyGraph** fetches context using hybrid retrieval (Semantic + Entity).
4. **Selected LLM** generates response with retrieved context.
5. **Post-Process:** Response sent to user; Interaction stored in **MollyGraph Ingestion Queue**.

#### 2.2 Voice Request (Gemini Live)
1. **User Audio** arrives via WebSocket to Gemini Live API.
2. **Context Pre-load:** Bridge pre-loads MollyGraph context (USER.md, last 50 turns, top 20 entities, goals, calendar) into Gemini's 2M context window.
3. **Voice-to-Voice:** Gemini processes audio and generates audio response directly (native multimodal).
4. **Tool Calling:** Gemini calls `query_memory(question)` for scoped facts during conversation (300-500ms latency).
5. **Memory Flow:** Bridge captures transcripts (User + Gemini) and saves to `episodes.jsonl` with `source="voice"` and `session_id`.
6. **Persistence:** Asynchronous ingestion into Neo4j/Qdrant follows.

#### 2.3 Proactive/Periodical Flow (System → User)
1. **Cron/Heartbeat** triggers a task (e.g., "Check Calendar").
2. **Task Agent** executes check and identifies "Actionable Info".
3. **Router** checks user state (Are they busy? What's the current time?).
4. **Delivery Tier** decides channel (Telegram for updates, Voice for urgent reminders).

### 3. State & Context Management
- **Short-term Memory:** Recent message history (last 10-15 messages) passed in prompt.
- **Long-term Memory (MollyGraph):** 
  - **Entities:** Extracted from messages and stored in Neo4j.
  - **Semantics:** Embeddings stored in Qdrant for similarity search.
- **User Model:** Persistent profile tracking preferences, habits, and ongoing projects.
- **Cache Tier:** Frequent queries (e.g., "What's my schedule?") cached to reduce LLM calls.

### 4. Error Handling & Fallbacks
- **Router Misclassification:** If Fast Tier fails (low confidence/error), automatically escalate to Slow Tier.
- **Memory Timeout:** If MollyGraph is slow/unresponsive (>1s), fall back to "Recency Only" context.
- **Service Failure:** If ElevenLabs is down, fall back to text-only with a "Voice service unavailable" note.

### 5. Monitoring & Metrics
- **Latency:** Tracked per tier (Router, Memory, LLM, TTS). Target: <2s for Text, <4s for Voice.
- **Cost:** Daily tracking of API usage (OpenAI, Anthropic, ElevenLabs) vs. Local usage (Ollama).
- **Accuracy:** Periodical "Reflection" tasks evaluate if the Router and Memory are providing relevant info.

### 6. File Structure (New Architecture)
```text
/services/
  ├── router/               # Classification & Routing logic
  ├── memory/               # MollyGraph (Neo4j, Qdrant, SQLite)
  ├── voice/                # Voice Tier (Vapi, Deepgram, Groq, Cartesia)
  ├── periodicals/          # Cron, Heartbeat, Proactive tasks
  └── monitoring/           # Metrics & Latency tracking
/skills/                    # Tool-based capabilities
/configs/                   # Model params, API keys, Prompts
/logs/                      # Unified system logging
```

### 7. Migration Plan
1. **Phase 1 (Shadow Routing):** Implement Router but keep everything on Slow Tier; log "would-be" routing decisions.
2. **Phase 2 (MollyGraph Integration):** Replace basic history with hybrid MollyGraph context.
3. **Phase 3 (Tiered Execution):** Enable Fast Tier for low-complexity queries.
4. **Phase 4 (Voice & Periodicals):** Integrate Vapi-based voice stack and standardize Cron jobs.
5. **Phase 5 (Full Cutover):** Decommission old single-tier architecture.
