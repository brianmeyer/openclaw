# MollyGraph Cron Setup

## Status: ✅ ACTIVE

**Approach Used:** System cron (Approach B)  
**Reason:** OpenClaw cron (Approach A) is designed for agent-based jobs, not shell scripts. System cron is more reliable for this use case.

## Cron Schedules

```
# Nightly Ingestion - 11:00 PM daily
0 23 * * * /Users/brianmeyer/.openclaw/workspace/services/mollygraph_nightly.sh >> /tmp/mollygraph_nightly.log 2>&1

# Daily Reflection - 11:30 PM daily (after nightly)
30 23 * * * /Users/brianmeyer/.openclaw/workspace/services/mollygraph_daily_reflection.py >> /tmp/mollygraph_daily.log 2>&1

# Weekly Reflection - Sundays 11:45 PM (after daily reflection)
45 23 * * 0 /Users/brianmeyer/.openclaw/workspace/services/mollygraph_weekly.sh >> /tmp/mollygraph_weekly.log 2>&1
```

## Pipeline Schedule

| Time | Job | What It Does |
|------|-----|--------------|
| 11:00 PM | Nightly Ingestion | Entities → Neo4j, Embeddings → Qdrant |
| 11:30 PM | Daily Reflection | Summary of day's activity, health checks |
| 11:45 PM (Sundays) | Weekly Reflection | Weekly patterns, user model update |

## What Each Job Does

### Nightly Ingestion
1. Checks Ollama health
2. Runs nightly ingestion (`mollygraph_ingest.py --mode=nightly`)
3. Processes entities and relationships
4. Updates embeddings

### Daily Reflection
1. Counts episodes from the day
2. Summarizes sources and experiments
3. Health check on services
4. Logs to `/tmp/mollygraph_daily.log`

### Weekly Reflection
1. Analyzes week's activity patterns
2. Updates user model with trends
3. Tracks averages over time
4. Logs to `/tmp/mollygraph_weekly.log`

## Verification

### Check all cron jobs:
```bash
crontab -l | grep mollygraph
```

### Check logs:
```bash
# Nightly
tail -f /tmp/mollygraph_nightly.log

# Daily
tail -f /tmp/mollygraph_daily.log

# Weekly
tail -f /tmp/mollygraph_weekly.log
```

### Manual test runs:
```bash
# Nightly ingestion
~/.openclaw/workspace/services/mollygraph_nightly.sh

# Daily reflection
~/.openclaw/workspace/services/trigger_daily_reflection.sh

# Weekly reflection
~/.openclaw/workspace/services/trigger_weekly_reflection.sh
```

### Check service status:
```bash
curl http://localhost:8001/health
```

## Dependencies

- Ollama running locally (port 11434)
- MollyGraph server running (port 8001)
- Neo4j (port 7687)
- Qdrant (port 6333)

## Troubleshooting

If cron doesn't run:
1. Check cron service: `sudo launchctl list | grep cron`
2. Check permissions: `ls -la ~/.openclaw/workspace/services/*.sh`
3. Check logs: `cat /tmp/mollygraph_*.log`

## Notes

- Uses local Ollama models only (cost: $0)
- Entity extraction disabled in current config (embedding only)
- Batch size: 100 episodes per run
- State tracked in: `mollygraph_ingest_state.json`
- User model stored in: `mollygraph_data/user_model.json`
