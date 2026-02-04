# MEMORY.md

## 🚀 Goals
1. **Sub-agents on Groq:** ✅ `groq/llama-3.3-70b-versatile` configured in `openclaw.json`.
2. **Primary Model:** ✅ `moonshot/kimi-k2.5` configured (Requires `openclaw gateway restart`).
3. **Moltbook:** ✅ Registered as `BrianMeyerClaw`. PENDING: Visit [Claim URL](https://moltbook.com/claim/moltbook_claim_1gyH_JXYp607I8d3FU3Obp_frAa4zsbo).

## 🧠 Preferences & Identity
- **Voice:** ElevenLabs TTS (Matilda voice, `eleven_v3`). Wake word: "Molly".
- **External Actions:** **DRAFT-ONLY POLICY**. Never send/post without explicit approval.
- **Custody Schedule:** Single dad, week-on/week-off (Preston 8, Greyson 4).

## 🛠️ Active Projects: MollyGraph Memory (Production)
- **Status:** LIVE. Neo4j (Knowledge Graph) + Qdrant (Vector Search).
- **Automation:** Nightly ingestion at 11 PM via `services/mollygraph_nightly.sh`.
- **Query Hook:** `services/memory_hook_production.py` (~550ms latency).
- **Tech Stack:** Neo4j, Qdrant, Ollama (embeddingGemma), SQLite (Work Memory).

## 🎓 Lessons Learned
- **Sub-agents:** Never spawn file-writing agents without chunking (<8KB) and verification.
- **Workflow:** Use ReAct loop (THINK → ACT → OBSERVE → VERIFY).
- **Infrastructure:** Check `work_memory` for past failures before repeating tasks.

## 🔜 Next Actions
- [ ] Visit Moltbook claim URL to verify ownership.
- [ ] Run `openclaw gateway restart` to activate Kimi 2.5.
- [ ] Investigate why autosave stopped working (noted 2026-02-02 09:45).
- [ ] Confirm current custody week (A or B).

## 📝 Daily Reflections

### 2026-02-03
**Daily Reflection** (Cost: $0.0012, 945 episodes)

Productive day focused on routing model development and system optimization. Trained and benchmarked multiple query routing models (TinyBERT, DistilBERT, ModernBERT) achieving 91.97% accuracy with ModernBERT. Fixed embeddingGemma consistency across 9 files. Reviewed and improved router code architecture.

**Key Topics:**
- Router model training and evaluation (TinyBERT vs DistilBERT vs ModernBERT)
- Extended test set benchmarking (822 examples, 91.97% accuracy)
- Embedding model standardization (embeddingGemma)
- System health checks and cron job scheduling
- Phone skills installation (phone-calls-bland, phone-agent)

**Decisions Made:**
- DistilBERT selected as production router (91.36% accuracy, 2.31ms latency)
- embeddingGemma standardized across all components
- Daily/weekly reflection cron jobs scheduled

**Action Items:**
- Deploy DistilBERT router to production
- Test phone skills
- Investigate latency optimization

---
*Raw logs archived in `memory/YYYY-MM-DD.md`*
