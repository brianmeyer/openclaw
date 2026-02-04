# Unified Molly Architecture: Phase 2 Synthesis

## 1. Executive Summary
This document synthesizes the designs for the Request Router, Voice Integration, and Overall System Architecture into a single, cohesive blueprint. The system transitions from a single-tier "one size fits all" LLM approach to a **multi-tiered, context-aware routing architecture** that optimizes for latency, cost, and conversational fluidness.

## 2. Component Review & Synthesis

### 2.1 The Router (DistilBERT Tier)
- **Review:** The DistilBERT model (`distilbert-base-uncased`) is well-chosen for local <10ms inference.
- **Synthesis:** The router acts as the "Traffic Controller." It must not only classify text complexity but also detect `VOICE_MODE` from the transcription characteristics (e.g., wake words like "Molly", disfluencies like "um", "uh").
- **Constraint:** The router must be the *first* hop after transcription to prevent expensive LLM calls for simple voice commands.

### 2.2 Voice Integration (Low-Latency Pipeline)
- **Review:** The target of <500ms for STT-to-TTS is aggressive but achievable using streaming.
- **Synthesis:** To meet this, we will use a **Streaming Hybrid Approach**. STT (Deepgram/Whisper) will stream to the Router, which will pre-warm either the Fast Tier (Groq) or Slow Tier (Claude) before the transcription is even complete.
- **Conflict Resolved:** `voice_architecture.md` suggested Vapi/ElevenLabs ConvAI (End-to-End), while `SYSTEM_ARCHITECTURE.md` suggested a modular STT -> Router -> LLM -> TTS. 
- **Decision:** Use the **Modular Pipeline** for maximum control over MollyGraph context injection, but utilize **WebSocket streaming** for all hops to keep latency under 1s.

### 2.3 MollyGraph (Unified Memory)
- **Review:** MollyGraph provides hybrid (Semantic + Entity) retrieval.
- **Synthesis:** For voice, retrieval must be limited to the top 3 most relevant "facts" plus the last 2-3 turns to minimize prompt bloat and processing time.

---

## 3. Unified End-to-End Architecture

### Data Path: Voice Request
1. **Audio Stream** -> WebSocket -> **Whisper/Deepgram** (Streaming Transcription)
2. **Partial Text** -> **DistilBERT Router** (Parallel Classification)
3. **Intent Identified:** 
   - If `fast_simple`: Route to **Groq Llama 3** + Minimal Context.
   - If `slow_complex`: Route to **Claude 3.5 Sonnet** + Full MollyGraph Context.
   - If `command` (e.g., "stop music"): Route to **Local Tool** (No LLM).
4. **LLM Output** (Streaming) -> **ElevenLabs** (Streaming TTS).
5. **Audio Response** delivered to user.

### Data Path: Text Request
1. **Message** -> **Router** -> **MollyGraph Context** -> **Selected Tier LLM** -> **User**.

---

## 4. Implementation Roadmap

### Phase 1: Router & Foundation (Immediate)
- Train DistilBERT on synthetic dataset (Fast/Slow/Voice/Command).
- Standardize the `Router` Python class as a shared service.
- Enable `latency.py` monitoring across all existing services.

### Phase 2: MollyGraph Optimization
- Implement "Context Throttling" (returning smaller chunks for Voice vs Text).
- Fix Neo4j entity extraction to run asynchronously in the background.

### Phase 3: The Streaming Pipeline
- Build the WebSocket orchestrator that links STT -> Router -> LLM -> TTS.
- Integration test with ElevenLabs "Matilda" voice.

### Phase 4: Proactive "Periodicals"
- Connect Cron tasks to the Router to decide *when* and *how* to interrupt the user (e.g., "Don't voice call if user is in a meeting").

---

## 5. Risk Assessment & Mitigation

| Risk | Impact | Mitigation |
|:---|:---|:---|
| **Transcription Error** | High (Router misclassifies) | Use confidence thresholds; default to Slow Tier if Router is unsure (<0.7). |
| **Memory Latency** | Med (Voice delay) | Implement a "Fast Context" cache for recent entities. |
| **API Cost Spikes** | Med (Slow Tier overuse) | Strict daily dollar limit in `cost_tracker.py`. |
| **Local Inference Load** | Low (Mac mini CPU) | Use ONNX quantization for DistilBERT and 4-bit quantization for local Ollama models. |

## 6. Next Steps
1. **Run** `routing_model_design/data_gen.py` to create the initial training set.
2. **Benchmark** current MollyGraph `get_context` latency to establish a baseline.
3. **Draft** the WebSocket Orchestrator spec for the Voice pipeline.
