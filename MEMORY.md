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
**Daily Reflection** (Cost: $0.02, 945 episodes)

Full day summary: Set up Google account for AI assistant, installed phone skills from ClawHub, discussed voice latency issues. Reviewed SYSTEM_ARCHITECTURE.md, audited GitHub repositories. Trained routing model using DistilBERT (91.36% accuracy, 2.31ms latency) and benchmarked against TinyBERT and ModernBERT. Standardized embeddingGemma across all components. Scheduled daily/weekly reflection cron jobs.

**Key Topics:**
- Google account setup (mollyixian@gmail.com)
- Phone skills installation (phone-calls-bland, phone-agent)
- Voice latency optimization (Gemini Live)
- SYSTEM_ARCHITECTURE.md updates
- GitHub repository audit
- Routing model training (DistilBERT: 91.36%, 2.31ms)
- embeddingGemma standardization
- Cron job scheduling

**Decisions Made:**
- Gemini Live for voice integration
- DistilBERT as production router
- embeddingGemma across all components
- Daily/weekly reflection automation

**Action Items:**
- Deploy router to production
- Test phone skills
- Continue headless-studio improvements

---
*Raw logs archived in `memory/YYYY-MM-DD.md`*
