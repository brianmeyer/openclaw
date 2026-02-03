# Agent Spawning Guidelines for Molly
# Auto-loaded before any sub-agent spawning decisions

## Critical Rules (From Failure Analysis)

1. **CHUNKING IS MANDATORY** for any file >200 lines
   - Split into multiple write() calls
   - Verify each chunk before proceeding
   - Maximum 8KB content per write

2. **VERIFICATION IS NOT OPTIONAL**
   - After every write: `ls -la && wc -l`
   - Check file exists and has expected line count
   - Never assume success

3. **ReAct LOOP REQUIRED** for multi-step tasks
   - THINK: Plan the approach
   - ACT: Execute one step
   - OBSERVE: Check results
   - VERIFY: Confirm success
   - CONTINUE: Only if verified

4. **MODEL SELECTION MATTERS**
   - Groq Llama 70B: Fast, structured tasks, good for speed
   - Kimi 2.5: Complex reasoning, fewer errors, use when accuracy critical
   - Default: Check MEMORY.md for current sub-agent model config

5. **NEVER-AGAIN PATTERNS** (recorded in work_memory):
   - Never spawn file-writing agents without chunk limits
   - Never skip verification steps
   - Never batch multi-file writes without per-file checks

## Quick Checklist Before Spawning

```
□ Task is parallelizable (no dependencies)
□ Output size estimated
□ Chunking strategy defined (if >200 lines)
□ Verification commands specified
□ Model explicitly chosen
□ Failure recovery documented
```

## Common Failure Modes & Prevention

| Failure | Cause | Prevention |
|---------|-------|------------|
| JSON truncation | Content >16KB | Chunk to <8KB per write |
| Empty files | No verification | Mandatory ls+wc after each write |
| Hallucination | No source requirements | Add "cite sources" constraint |
| Wrong format | Ambiguous instructions | Provide explicit template |
| Partial write | Network/tool error | Verify content length matches |

## Work Memory Integration

Before spawning, check:
- `work_memory.db` for similar past tasks
- `failures` table for never-again rules
- `success_patterns` for what worked

After spawning, record:
- `experiments` table with outcome
- `failures` table if anything went wrong
- `success_patterns` if it worked well

## Spawning Template

Use template from:
`~/.openclaw/workspace/services/sub_agent_template.md`

Always include:
- Explicit constraints section
- ReAct loop instructions
- Mandatory verification commands
- Output format requirements
