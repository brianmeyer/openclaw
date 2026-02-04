# Molly Architecture Redesign: Implementation & Migration Plan

## 1. File Structure (Target State)

```text
/Users/brianmeyer/.openclaw/workspace/
├── services/
│   ├── router/
│   │   ├── classifier.py       # Intent/Complexity classification
│   │   └── engine.py           # Routing logic & tier selection
│   ├── memory/
│   │   ├── graphiti_server.py  # MollyGraph API
│   │   ├── neo4j_client.py     # Graph database operations
│   │   └── qdrant_client.py    # Vector database operations
│   ├── voice/
│   │   ├── whisper_stt.py      # Speech-to-Text
│   │   └── elevenlabs_tts.py   # Text-to-Speech (SAG integration)
│   ├── periodicals/
│   │   ├── cron_manager.py     # System cron wrappers
│   │   └── heartbeat.py        # Proactive check logic
│   └── monitoring/
│       ├── latency.py          # Timing decorators for all services
│       └── cost_tracker.py     # API spend aggregation
├── configs/
│   ├── prompts/                # Tier-specific system prompts
│   └── models.yaml             # Model mapping (Fast/Slow/Voice)
```

## 2. Migration Roadmap

### Phase 1: Foundation (Current Week)
- [ ] Stabilize **MollyGraph** (Current status: Running, needs entity extraction enabled).
- [ ] Implement the **Router Service** as a standalone module.
- [ ] Setup **Monitoring** decorators to capture baseline latency.

### Phase 2: Tiered Execution (Next Week)
- [ ] Define "Fast" and "Slow" tier prompts.
- [ ] Switch main agent logic to call the `Router` before execution.
- [ ] Implement "Shadow Routing" (run both, compare, but use Slow Tier output).

### Phase 3: Voice & Periodicals
- [x] Standardize the **Vapi (Voice Stack)** integration into the Voice service.
- [ ] Implement **Fast Context** mode for Voice (retrieval <100ms).
- [ ] Migrate all disparate shell scripts in `services/` to the `periodicals/` module.
- [ ] Unify `HEARTBEAT.md` and `CRON_SETUP.md` into a single management interface.

### Phase 4: State & User Model
- [ ] Deploy the **User Model Manager** (MollyGraph's `user_model.json`).
- [ ] Implement "Cross-Session Summarization" (Daily reflections feeding the User Model).

## 3. Success Metrics

| Metric | Baseline | Target |
|:---|:---|:---|
| **Text Latency** | ~3-5s (All queries Slow) | <2s (Fast) / <4s (Slow) |
| **Memory Context** | Last N messages only | Hybrid (Semantic + Entity + Recent) |
| **API Cost** | High (All Claude 3.5) | 40% Reduction (via Fast Tier/Local) |
| **Voice Delay** | N/A | <1s (Time to First Audio) |
| **System Reliability** | Manual recovery | 99% (Automated Tier Fallbacks) |
