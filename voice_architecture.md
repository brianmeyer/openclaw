# Voice Architecture: Gemini Live Integration

## 1. Overview
The voice system uses **Gemini Live API** for native voice-to-voice interaction. This replaces the previous modular stack (Vapi/Deepgram/Groq/ElevenLabs) with a unified multimodal model, reducing context-switching artifacts and providing a more natural flow.

## 2. Component Stack
- **Engine:** Gemini 2.0 Flash (Multimodal)
- **Protocol:** WebSocket (Audio streaming in/out)
- **Bridge:** OpenClaw Voice Bridge (Python/Node)
- **Memory Hook:** MollyGraph Context Pre-loader
- **Tools:** `query_memory` (Scoped graph retrieval)

## 3. Context Management (Pre-loading)
To ensure the voice model has full situational awareness without expensive mid-call retrieval for every turn, we utilize Gemini's 2M token context window by pre-loading:
- **Profile:** Full contents of `USER.md`
- **History:** Last 50 conversation turns (all sources)
- **Entities:** Top 20 relevant entities from Neo4j (Key people, projects, locations)
- **Current State:** Active goals, priorities, and upcoming calendar events

## 4. Tool Calling: `query_memory`
Gemini can call this tool when the pre-loaded context is insufficient.
- **Input:** A specific natural language question.
- **Logic:** Scoped RAG (Retrieval-Augmented Generation) against Qdrant/Neo4j.
- **Target Latency:** 300-500ms for retrieval + model processing.
- **Constraints:** Returns specific facts, not full document dumps, to minimize token usage and response delay.

## 5. Data Flow & Logging
The Voice Bridge monitors the WebSocket for transcripts of both user and model turns.
- **Persistence:** Each turn is saved to `episodes.jsonl`.
- **Metadata:**
  - `source`: "voice"
  - `session_id`: Unique ID for the voice call session.
  - `timestamp`: ISO-8601.
- **Ingestion:** These episodes are processed by the standard MollyGraph pipeline for long-term memory.

## 6. Performance Targets
| Metric | Target |
| :--- | :--- |
| **End-to-End Latency** | < 1.5s (Voice-to-Voice) |
| **Memory Query Latency** | 300-500ms |
| **Context Refresh Rate** | Once per session start |
| **Accuracy of Entity Recall** | > 95% (via pre-loading) |

## 7. Architecture Diagram
```text
[ User ] <--- WebSocket (Audio) ---> [ Gemini Live API ]
                                          |
                                  [ Tool: query_memory ] <───► [ MollyGraph ]
                                          |
                                 [ OpenClaw Bridge ]
                                          |
                -------------------------------------------------
                |                        |                      |
        [ Log: episodes.jsonl ]   [ Context Pre-load ]   [ Ingestion ]
                |                        |                      |
          (source="voice")         (USER.md, History)      (Neo4j/Qdrant)
```
