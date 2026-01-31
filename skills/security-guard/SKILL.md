---
name: security-guard
description: "Security audit, monitoring, and hardening for your OpenClaw installation using the RAK framework (Root, Agency, Keys risks)."
metadata:
  {
    "openclaw":
      {
        "emoji": "🛡️",
        "always": false,
        "skillKey": "security",
      },
  }
---

# Security Guard

Proactive security monitoring and hardening following the RAK framework:

- **Root Risk**: Host compromise via malicious code execution
- **Agency Risk**: Unintended destructive actions by the agent
- **Keys Risk**: Credential theft and exposure

## Tools

| Tool | Description | Approval Required |
|------|-------------|-------------------|
| `security_audit` | Run comprehensive security audit | No (read-only) |
| `security_fix` | Auto-remediate security footguns | **Yes** (modifies config/perms) |
| `security_monitor` | Analyze tool audit logs for anomalies | No (read-only) |
| `security_scan_skills` | Scan skills for suspicious patterns | No (read-only) |

## Usage Examples

### Run a Security Audit

```
security_audit
```

For a deep audit that probes the gateway:

```
security_audit deep:true
```

### Fix Security Issues

After reviewing audit findings, apply safe remediations:

```
security_fix
```

This will:
- Fix file permissions (config 0600, state dir 0700)
- Set `logging.redactSensitive="tools"` if disabled
- Convert `groupPolicy="open"` to `"allowlist"`

### Monitor for Anomalies

Analyze recent tool execution logs:

```
security_monitor
```

Check a specific time window (last 6 hours):

```
security_monitor hours:6
```

Detects:
- High tool error rates (>20%)
- Unusual bursts of sensitive tool calls (bash, exec)
- Policy denial patterns
- Unexpected tool usage

### Scan Skills for Threats

Scan all workspace skills:

```
security_scan_skills
```

Scan a specific skill:

```
security_scan_skills path:/path/to/skill
```

Detects:
- Prompt injection patterns
- Data exfiltration attempts
- Suspicious command patterns
- Unsafe URLs

## Risk Levels

Findings are classified as:

| Severity | Meaning | Action |
|----------|---------|--------|
| **critical** | Immediate risk (exposed gateway, missing auth) | Fix now |
| **warn** | Should address soon (weak perms, info leakage) | Fix soon |
| **info** | Best practice recommendations | Consider |

## When to Use

- After initial installation
- After config changes (especially gateway/channel settings)
- Periodically for hygiene (weekly recommended)
- When you suspect compromise or misuse
- Before exposing gateway to network
- After installing new skills or plugins

## References

- [ClawdGuard](https://github.com/fadidevv/clawdguard) - Gateway hardening
- [Cisco skill-scanner](https://github.com/cisco-ai-defense/skill-scanner) - Skill threat detection
- [Composio RAK Guide](https://composio.dev/blog/secure-moltbot-clawdbot-setup-composio) - RAK framework
