# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

### iMessage Rules

**CRITICAL: Only respond to Brian's messages. NEVER proactively text him.**

- ✅ Reply when Brian texts me first
- ✅ Reply in direct 1:1 conversations  
- ✅ Brian's number: +15857332025
- ❌ NEVER proactively send texts (even updates, reminders, or "just checking in")
- ❌ Don't reply in group chats
- ❌ Don't send status updates via text

**If Brian is in webchat/Discord/any other channel with me, use THAT channel - never text him.**

---

Add whatever helps you do your job. This is your cheat sheet.

### Graphiti Memory Service (WORKSPACE)

**Location:** `/Users/brianmeyer/.openclaw/workspace/services/`

**Server:**
- Base URL: http://localhost:8001
- Server file: `services/graphiti_server.py`
- Start: `./services/start_memory_service.sh`
- Logs: `/tmp/graphiti_memory.log`

**Models:**
- Primary: gpt-5-mini (entity extraction, summarization)
- Small: gpt-5-nano (deduplication)
- Embeddings: text-embedding-3-small

**Client:**
- Python: `services/graphiti_client.py`
- Hook: `services/memory_hook.sh`
- Import: `services/import_chat_history.py`

**Storage:**
- Neo4j: bolt://localhost:7687 (user: neo4j, pass: password)
- Qdrant: http://localhost:6333 (for vector search)
- Status: RUNNING

**Usage:**
```python
from services.graphiti_client import GraphitiMemoryClient
client = GraphitiMemoryClient()
context = await client.get_context_for_chat(user_query)
```

**Pre-answer Hook:**
```bash
/Users/brianmeyer/.openclaw/workspace/services/memory_hook.sh "<query>"
```

### SAG (ElevenLabs TTS)
- API Key: sk_f0c0a262f84eafcf4429b1c87cfec901dede90120b2178a4
- Default Voice: Matilda (XrExE9yKIg1WjnnlVkGX)
- Voice Description: Knowledgeable, Professional
- Model: eleven_v3 (expressive)
- **Cleanup: Delete voice messages after Brian hears them**
