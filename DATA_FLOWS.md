# Molly Architecture Redesign: Data Flow Specifications

This document details the specific data flows for each interaction type in the new architecture.

## 1. Text Query Flow (Standard)

| Step | Component | Action | Data/Format |
|:---|:---|:---|:---|
| 1 | **Input** | User sends message via Channel (Telegram, etc.) | Raw Text |
| 2 | **Router** | Classifies complexity and intent | `Intent`, `Tier` (Fast/Slow) |
| 3 | **Context** | Hybrid retrieval from MollyGraph | `[Messages]`, `[Entities]` |
| 4 | **LLM** | Prompt = Context + User Model + Query | Generated Response |
| 5 | **Memory** | Async ingestion of the new exchange | `Graphiti` update |
| 6 | **Output** | Send response back to user via original channel | Markdown Text |

## 2. Voice Interaction Flow (Gemini Live)

| Step | Component | Action | Data/Format |
|:---|:---|:---|:---|
| 1 | **Input** | User opens WebSocket; sends audio stream | PCM/Opus |
| 2 | **Context** | Bridge pre-loads 2M window with MollyGraph data | Text/JSON |
| 3 | **Model** | Gemini processes audio + context natively | Multimodal |
| 4 | **Tool** | Gemini calls `query_memory` if facts needed | JSON Query |
| 5 | **Output** | Gemini returns audio stream to user | Audio stream |
| 6 | **Memory** | Bridge saves transcript to `episodes.jsonl` | `source: "voice"` |

## 3. Memory Schema Update (Episodes)

All interactions saved to `episodes.jsonl` and ingested into Neo4j must include:
- `source`: `"telegram"` | `"imessage"` | `"voice"` | `"whatsapp"` | `"web"`
- `session_id`: Unique string (Voice call ID or Chat ID)
- `content`: Transcription or text message
- `timestamp`: Current time
- `metadata`: Tool calls, latency, model used

## 3. Proactive/Periodical Flow (System-Initiated)

| Step | Component | Action | Data/Format |
|:---|:---|:---|:---|
| 1 | **Trigger** | Cron/Heartbeat fires based on schedule | `event_type` |
| 2 | **Evaluator** | Task agent checks source (Email, Cal, Web) | `Findings` |
| 3 | **Filter** | Check "User Model" for notification preferences | `Notify?` (Yes/No) |
| 4 | **Router** | Selects channel based on urgency and time | `Channel` (Telegram/Voice) |
| 5 | **Delivery** | Message sent to user proactively | Notification |
| 6 | **State** | Record notification in `heartbeat-state.json` | `last_check` updated |

## 4. Error Handling Flow (Fallback Logic)

| Failure | Detection | Recovery Action |
|:---|:---|:---|
| **Tier Failure** | Timeout or 5xx from LLM API | Re-route to alternative Tier (Fast -> Slow) |
| **Memory Lag** | Memory hook exceeds 1500ms | Skip graph, use last 5 msgs from DB only |
| **TTS Error** | ElevenLabs API failure | Notify user: "Audio failed, here is the text..." |
| **Router Ambiguity** | Low confidence score (<0.6) | Default to Slow Tier for safety |
