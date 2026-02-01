---
name: graphiti
description: Temporal knowledge graph memory using Graphiti (Zep). Store and query entities, relationships, and episodes with bi-temporal awareness for agent memory.
homepage: https://github.com/getzep/graphiti
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "requires": { "bins": ["mcporter"], "env": ["GRAPHITI_MCP_URL"] },
        "install":
          [
            {
              "id": "mcporter",
              "kind": "node",
              "package": "mcporter",
              "bins": ["mcporter"],
              "label": "Install mcporter (required for MCP)",
            },
          ],
        "config":
          {
            "GRAPHITI_MCP_URL": "URL of the Graphiti MCP server (e.g., http://localhost:8000)",
            "NEO4J_URI": "Neo4j connection URI (e.g., bolt://localhost:7687)",
            "NEO4J_USER": "Neo4j username",
            "NEO4J_PASSWORD": "Neo4j password",
          },
      },
  }
---

# Graphiti - Temporal Knowledge Graph Memory

Use Graphiti to build and query temporal knowledge graphs for agent memory. Graphiti provides:

- **Bi-temporal model**: Track when facts became true AND when you learned them
- **Entity extraction**: Automatically extract entities and relationships from episodes
- **Semantic search**: Find relevant facts using embeddings
- **Conflict resolution**: Handle contradictory information with temporal awareness

## Setup

The stack runs locally with Docker Compose. Uses OpenAI for inference and Ollama for embeddings.

### Quick Start (Docker Compose)

```bash
cd skills/graphiti
docker compose up -d

# Pull the embedding model into Ollama
docker exec -it graphiti-ollama-1 ollama pull embeddinggemma
```

### Configure OpenClaw

```bash
openclaw config set env.GRAPHITI_MCP_URL http://localhost:8000
openclaw config set env.OPENAI_API_KEY your-api-key
```

### Architecture

- **Neo4j** (port 7474/7687): Graph database storing entities, relationships, and episodes
- **Ollama** (port 11434): Local embeddings with `embeddinggemma`
- **OpenAI**: LLM inference via `gpt5-mini` (main) and `gpt5-nano` (lightweight)
- **Graphiti MCP** (port 8000): MCP server exposing Graphiti tools

### Manual Setup (Alternative)

If you prefer manual Docker commands:

```bash
# Neo4j
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/Greyson0217 \
  -e NEO4J_PLUGINS='["apoc"]' \
  neo4j:5.26

# Ollama
docker run -d --name ollama -p 11434:11434 ollama/ollama:latest
docker exec ollama ollama pull embeddinggemma

# Graphiti MCP
docker run -d --name graphiti-mcp -p 8000:8000 \
  -e NEO4J_URI=bolt://host.docker.internal:7687 \
  -e NEO4J_USER=neo4j \
  -e NEO4J_PASSWORD=Greyson0217 \
  -e MODEL_PROVIDER=openai \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e OPENAI_MODEL=gpt5-mini \
  -e OPENAI_MODEL_SMALL=gpt5-nano \
  -e EMBEDDING_PROVIDER=ollama \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OLLAMA_EMBEDDING_MODEL=embeddinggemma \
  zepai/graphiti-mcp:latest
```

## Usage

### Add an Episode (Conversation/Event)

Store a conversation or event as an episode. Graphiti automatically extracts entities and relationships.

```bash
mcporter call $GRAPHITI_MCP_URL.add_episode \
  name="security_audit" \
  episode_body="User ran security audit. Found 3 critical issues in auth module. Agent recommended fixing JWT validation." \
  source="agent" \
  source_description="Security hardening session"
```

### Search for Facts

Query the knowledge graph using semantic search.

```bash
mcporter call $GRAPHITI_MCP_URL.search \
  query="What security issues were found?" \
  num_results:5
```

### Get Entity Details

Retrieve information about a specific entity.

```bash
mcporter call $GRAPHITI_MCP_URL.get_entity \
  name="auth module"
```

### Temporal Queries

Query the graph as it existed at a specific point in time.

```bash
mcporter call $GRAPHITI_MCP_URL.search \
  query="security findings" \
  center_node_uuid="..." \
  reference_time="2026-01-15T00:00:00Z"
```

### Delete Episodes

Remove episodes and their derived facts from the graph.

```bash
mcporter call $GRAPHITI_MCP_URL.delete_episode \
  episode_uuid="..."
```

## MCP Tools Available

| Tool | Description |
|------|-------------|
| `add_episode` | Ingest text/conversations into the knowledge graph |
| `search` | Semantic + graph search for relevant facts |
| `get_entity` | Get details about an entity by name/UUID |
| `get_episodes` | Retrieve episodes by reference |
| `delete_episode` | Remove an episode and its facts |
| `get_entity_edge` | Get relationships for an entity |
| `open_group` | Create/open a group namespace |
| `clear_graph` | Clear all data (use with caution) |

## Security Integration

For security monitoring, ingest audit events as episodes:

```bash
# After each agent session, capture key events
mcporter call $GRAPHITI_MCP_URL.add_episode \
  name="session_$SESSION_ID" \
  episode_body="$(cat ~/.openclaw/logs/tool-audit.jsonl | tail -50)" \
  source="audit_log" \
  source_description="Tool execution audit log"
```

Query security history:

```bash
# What destructive commands were blocked?
mcporter call $GRAPHITI_MCP_URL.search \
  query="destructive commands blocked" \
  num_results:10

# What files did agents access?
mcporter call $GRAPHITI_MCP_URL.search \
  query="file access by agent" \
  num_results:20
```

## Tips

- Use meaningful episode names for easier retrieval
- Include timestamps in episode bodies for temporal context
- Group related sessions using Graphiti groups
- Regularly ingest audit logs to build security knowledge graph
- Use `center_node_uuid` for graph-aware search starting from known entities

## Resources

- [Graphiti GitHub](https://github.com/getzep/graphiti)
- [Graphiti Docs](https://docs.getzep.com)
- [Neo4j Browser](http://localhost:7474) - Visualize your knowledge graph
