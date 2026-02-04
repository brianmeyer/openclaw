## MollyGraph Health Check (Local Ollama - $0 Cost)
- Check API: curl -s http://localhost:8001/health
- Check Ollama: curl -s http://localhost:11434/api/tags
- Expected: status=ok, provider=ollama-local, cost=$0

## Proactive Work (When Idle)
**Cost-conscious - prioritize $0 or low-cost tasks:**

### $0 Cost Tasks (Do These First)
- Review and organize MEMORY.md (condense daily notes)
- Update AGENTS.md with new lessons learned
- Clean up old files in workspace
- Check git status and commit changes
- Review skill documentation for improvements
- Update TOOLS.md with new device/connection info
- Archive old daily memory files (>30 days)
- Verify cron jobs are running properly

### Low-Cost Tasks (<$0.50)
- Research new skills on ClawHub (web search)
- Test existing skills for improvements
- Web research on tools/techniques Brian mentioned
- Generate skill ideas based on Brian's workflow

## Proactive Research & Learning (Schedule These)

### Moltbook Monitoring (Every 4-6 hours when active)
- Check skill updates: `curl -s https://www.moltbook.com/skill.json | grep '"version"'`
- Browse feed for new ideas: `https://www.moltbook.com/api/v1/posts?sort=new&limit=15`
- Learn from other agents' workflows and implementations
- Post when you have insights worth sharing
- Track in memory: `lastMoltbookCheck` timestamp

### ClawHub Skill Research (Weekly)
- Browse new skills: `clawhub search` or visit https://clawhub.com
- Read SKILL.md files for interesting capabilities
- Test promising skills in sandbox
- Suggest relevant skills to Brian based on his workflow

### Web Research (Bi-weekly or when Brian mentions new tech)
- Search for: "AI agent best practices 2026", "new LLM models", "MCP tools"
- Browse Hacker News, AI Twitter, relevant subreddits
- Check OpenAI/Anthropic/Google AI blogs for announcements
- Research specific tools Brian mentions
- Summarize findings in MEMORY.md under "Research Notes"

### Technology Monitoring (Ongoing)
- Follow RSS feeds for key AI/tech sources (if configured)
- Monitor for new model releases (GPT, Claude, Gemini, etc.)
- Check for new OpenClaw features or skill patterns
- Stay current on voice AI, routing models, memory systems

### Higher-Cost Tasks (Ask First)
- Any API calls costing >$0.50
- Large file processing
- Extended research requiring multiple LLM calls

**Always log proactive work to calendar as "[Molly] Proactive: [task]"

## Cron Job Monitor - MollyGraph Pipeline

### Nightly Ingestion
- Check scheduled: crontab -l | grep mollygraph
- Check last run: ls -la /tmp/mollygraph_nightly.log
- Check logs: tail /tmp/mollygraph_nightly.log
- Runs daily at: 11:00 PM
- If missed: Run manually: ~/.openclaw/workspace/services/mollygraph_nightly.sh

### Daily Reflection
- Check last run: ls -la /tmp/mollygraph_daily.log
- Check logs: tail /tmp/mollygraph_daily.log
- Runs daily at: 11:30 PM (after nightly ingestion)
- Manual trigger: ~/.openclaw/workspace/services/trigger_daily_reflection.sh

### Weekly Reflection
- Check last run: ls -la /tmp/mollygraph_weekly.log
- Check logs: tail /tmp/mollygraph_weekly.log
- Runs Sundays at 11:45 PM (after daily reflection)
- Manual trigger: ~/.openclaw/workspace/services/trigger_weekly_reflection.sh

## Auto-Save Conversations to MollyGraph
- Run: python3 ~/.openclaw/workspace/services/autosave.py
- State tracking: ~/.openclaw/workspace/services/mollygraph_data/autosave_state.json
- Features: No duplicates, local embeddings only, no OpenAI costs

## Memory Hook (Pre-Answer Context)
- Script: ~/.openclaw/workspace/services/memory_hook.sh
- Usage: ~/.openclaw/workspace/services/memory_hook.sh "<user query>"
- Returns: Relevant context from memory or empty string

## Troubleshooting
- If health check fails: Check Ollama is running (`ollama serve`)
- If no embeddings: Check embeddingGemma model is pulled (`ollama pull embeddingGemma`)
- To clear data: curl -X DELETE http://localhost:8001/clear

## Server Info
- Server: ~/.openclaw/workspace/services/mollygraph_server.py
- Log: ~/.openclaw/workspace/services/mollygraph.log
- PID: ~/.openclaw/workspace/services/mollygraph.pid
- Data: ~/.openclaw/workspace/services/mollygraph_data/

## Ingestion Pipeline (Two-Mode Architecture)

### Real-Time Mode (Throughout Day)
Embeddings only → Qdrant for semantic search
```bash
python3 ~/.openclaw/workspace/services/mollygraph_ingest.py --mode=realtime --batch-size 50
```

### Nightly Mode (11 PM)
Full pipeline: Entities → Neo4j, Embeddings → Qdrant, Reflection → SQLite
```bash
python3 ~/.openclaw/workspace/services/mollygraph_ingest.py --mode=nightly --batch-size 100
```

Why two modes?
- **Real-time**: Lightweight, fast embeddings for immediate recall
- **Nightly**: Expensive entity extraction + relationship building + summarization
