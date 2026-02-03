# High-Level Goals

1. **Sub-agents on Groq:** ✅ **CONFIGURED**
   - Model: `groq/llama-3.3-70b-versatile`
   - Location: `agents.defaults.subagents.model` in `~/.openclaw/openclaw.json`
   - Any subagents spawned will use Groq automatically

2. **Main Model Kimi 2.5:** ✅ **CONFIGURED (PENDING RESTART)**
   - Changed `agents.defaults.model.primary` from `google/gemini-3-pro-preview` to `moonshot/kimi-k2.5`
   - Will take effect after `openclaw gateway restart`

3. **Moltbook:** ✅ **REGISTERED - PENDING CLAIM**
   - Agent Name: BrianMeyerClaw
   - Profile: https://moltbook.com/u/BrianMeyerClaw
   - API Key: `moltbook_sk_V0SVkVMSPww4fU28sNB0WPCSTUB1iXTF`
   - Verification Code: `deep-BMWY`
   - Claim URL: https://moltbook.com/claim/moltbook_claim_1gyH_JXYp607I8d3FU3Obp_frAa4zsbo
   - Credentials saved to `~/.config/moltbook/credentials.json`
   - Status: `pending_claim` (waiting for human to visit claim URL)

---

## MollyGraph Memory System - PRODUCTION ✅

**Status:** LIVE and operational

### Architecture
- **Neo4j** (port 7474): Temporal knowledge graph - 114 entities, 115 relationships
- **Qdrant** (port 6333): Vector search - 1,136 episode embeddings
- **SQLite**: Work memory - experiments, failures, lessons

### Automated Pipelines
- **Nightly Ingestion**: Cron job at 11 PM daily
  - Script: `services/mollygraph_nightly.sh`
  - Extracts entities/relationships via Groq API
  - Imports to Neo4j automatically
  - Cost: ~$0.15/day for full daily history

- **Real-time Embeddings**: Local Ollama (embeddingGemma)
  - $0 cost, 768-dim vectors
  - Stored in Qdrant for semantic search

### Production Hook
- **Unified Memory Query**: `services/memory_hook_production.py`
- **Latency**: ~550ms parallel queries to all three sources
- **Usage**: Automatically called before responses for context

### Key Entities Tracked
- **Brian Meyer** (canonical, mention_count: 3, aliases: ["Brian", "brianmeyer"])
- **Family**: Single dad, week-on/week-off custody
  - Preston: 8 years old (turns 9 in April)
  - Greyson: 4 years old (turns 5 in February)
  - Schedule: Week A/Week B alternating (need to confirm which is current)
- **Voice**: ElevenLabs TTS configured (Matilda voice, eleven_v3)
  - API key in openclaw.json talk config
  - OpenClaw Talk Mode ready (wake word: "Molly")
- Technologies: Neo4j, Qdrant, OpenClaw, GPT-5, Ollama, Docker
- Organizations: OpenAI, Groq, ClawHub, Guidehouse
- Events: Server Restarted, Importing Chat History
- Concepts: Entity Extraction, Deduplication, Parallel Execution

### Temporal Fields
- `last_mentioned`: Conversation timestamp
- `mention_count`: Frequency of mentions
- `extracted_at`: When extracted

### Cost To Date
- Initial extraction (1,136 episodes): $0.036
- Daily incremental: ~$0.01-0.05

---

## 2026-02-02 - MollyGraph Production Deploy ✅

**Major Accomplishments:**
1. **Fixed entity extraction pipeline** - Resolved hanging issues with TOOLRESULT filtering
2. **Complete data extraction** - 1,136 episodes → 116 entities → 115 relationships
3. **Neo4j production import** - All entities with temporal fields (last_mentioned, mention_count)
4. **Entity deduplication** - Merged Brian/Brian Meyer/brianmeyer into canonical node (mention_count: 3)
5. **Unified memory hook** - Parallel queries to Neo4j + Qdrant + SQLite (~550ms)
6. **Production cron job** - Nightly ingestion at 11 PM
7. **Cost**: $0.036 total for full extraction

**Files Created:**
- `services/mollygraph_nightly.sh` - Daily ingestion
- `services/unified_memory_hook.py` - Core query engine
- `services/memory_hook_production.py` - Real-time context retrieval

**Issue Identified:** Autosave stopped working at 09:45 — needs investigation

---

## Agent Spawning Lessons (2026-02-02)

**Failure:** 3 of 4 sub-agents failed during Phase 1 schema design
- **Cause:** JSON payload truncation at ~16KB when writing large files
- **Root Cause:** No chunking strategy, no verification steps, no ReAct framework
- **Impact:** $0.59 wasted, manual intervention required

**Recorded in work_memory.db:**
- Experiment: `exp_20260202_085015` (FAIL)
- Failure: `fail_20260202_085015` (preventable)
- Never-again rule: NEVER spawn file-writing agents without chunking limits + verification

**Templates Created:**
- `~/.openclaw/workspace/services/sub_agent_template.md` - Reusable spawning templates
- `~/.openclaw/workspace/AGENT_SPAWNING.md` - Quick reference guidelines

**Key Constraints for Future Spawns:**
1. Max 200 lines / 8KB per write() call
2. Mandatory verification: `ls -la && wc -l` after every write
3. ReAct loop: THINK → ACT → OBSERVE → VERIFY → CONTINUE
4. Explicit model selection (Groq for speed, Kimi for accuracy)
5. Check work_memory for similar past tasks before spawning

---

## 2026-02-03 - External Action Guardrails Established ✅

**Policy:** Draft-Only for All External Actions

**Binding rules added to AGENTS.md:**
- Email: Draft only, wait for explicit "send it" approval
- Phone calls: Ask before placing ANY call
- Social media: Draft posts, wait for explicit approval
- Calendar invites: Confirm recipient list before sending
- Messages: Reply only to user, never initiate outbound

**Confirmation Protocol:**
STOP → DRAFT → PRESENT → WAIT → EXECUTE (only after approval)

**Rationale:** Brian expressed concern about unauthorized sends. This policy is absolute - no exceptions, no assumptions.

---

**Next Actions:**
- Visit the Moltbook claim URL to verify ownership via X/Twitter
- Restart OpenClaw gateway to activate Kimi 2.5 as main model
- Test subagent spawning using new templates
