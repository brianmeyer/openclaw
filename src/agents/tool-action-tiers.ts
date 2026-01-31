/**
 * Tool action tier classification.
 *
 * Classifies tools into read/write/destructive tiers based on
 * Composio's action-level control patterns.
 */

import type { ActionTier, ActionTierClassification } from "../config/types.action-tiers.js";

/**
 * Static tool tier classifications.
 *
 * Tools are classified based on their potential impact:
 * - read: Only observes state, no side effects
 * - write: Modifies state but is generally reversible
 * - destructive: Could cause irreversible damage
 */
const TOOL_TIER_MAP: Record<string, { tier: ActionTier; reason: string }> = {
  // Read tier - observation only
  read: { tier: "read", reason: "File reading is observational" },
  web_search: { tier: "read", reason: "Web search is observational" },
  web_fetch: { tier: "read", reason: "Web fetch is observational" },
  memory_search: { tier: "read", reason: "Memory search is observational" },
  memory_get: { tier: "read", reason: "Memory retrieval is observational" },
  sessions_list: { tier: "read", reason: "Listing sessions is observational" },
  sessions_history: { tier: "read", reason: "Reading history is observational" },
  session_status: { tier: "read", reason: "Status check is observational" },
  agents_list: { tier: "read", reason: "Listing agents is observational" },
  security_audit: { tier: "read", reason: "Security audit is observational" },
  security_monitor: { tier: "read", reason: "Security monitoring is observational" },
  security_scan_skills: { tier: "read", reason: "Skill scanning is observational" },
  image: { tier: "read", reason: "Image analysis is observational" },

  // Write tier - modifies state but reversible
  write: { tier: "write", reason: "File writing modifies state" },
  edit: { tier: "write", reason: "File editing modifies state" },
  apply_patch: { tier: "write", reason: "Patching modifies files" },
  message: { tier: "write", reason: "Sending messages has side effects" },
  sessions_send: { tier: "write", reason: "Sending to sessions has side effects" },
  sessions_spawn: { tier: "write", reason: "Spawning sessions creates resources" },
  cron: { tier: "write", reason: "Scheduling tasks creates resources" },
  gateway: { tier: "write", reason: "Gateway operations modify state" },
  browser: { tier: "write", reason: "Browser actions can modify state" },
  canvas: { tier: "write", reason: "Canvas operations modify state" },
  nodes: { tier: "write", reason: "Node operations can modify state" },
  tts: { tier: "write", reason: "Text-to-speech creates output" },
  security_fix: { tier: "write", reason: "Security fixes modify configuration" },

  // Destructive tier - high risk, potentially irreversible
  exec: { tier: "destructive", reason: "Shell execution can run destructive commands" },
  process: { tier: "destructive", reason: "Process control can terminate processes" },
  elevated_exec: { tier: "destructive", reason: "Elevated execution bypasses safety" },
};

/**
 * Patterns that indicate destructive shell commands.
 */
export const DESTRUCTIVE_COMMAND_PATTERNS = [
  // File deletion
  { pattern: "rm\\s+-[rf]+", description: "Recursive/forced file deletion", severity: "critical" },
  {
    pattern: "rm\\s+--no-preserve-root",
    description: "Root deletion allowed",
    severity: "critical",
  },
  { pattern: "rmdir\\s+", description: "Directory removal", severity: "warn" },
  { pattern: "unlink\\s+", description: "File unlinking", severity: "warn" },

  // Disk operations
  { pattern: "dd\\s+", description: "Direct disk write", severity: "critical" },
  { pattern: "mkfs", description: "Filesystem creation (destructive)", severity: "critical" },
  { pattern: "fdisk", description: "Disk partitioning", severity: "critical" },
  { pattern: "parted", description: "Disk partitioning", severity: "critical" },

  // Database destruction
  {
    pattern: "DROP\\s+(TABLE|DATABASE|SCHEMA)",
    description: "Database DROP operation",
    severity: "critical",
  },
  { pattern: "TRUNCATE\\s+TABLE", description: "Table truncation", severity: "critical" },
  {
    pattern: "DELETE\\s+FROM\\s+\\w+\\s*(;|$|WHERE\\s+1)",
    description: "Mass DELETE",
    severity: "warn",
  },

  // Git destructive operations
  {
    pattern: "git\\s+push\\s+.*--force",
    description: "Force push overwrites history",
    severity: "critical",
  },
  {
    pattern: "git\\s+push\\s+-f",
    description: "Force push overwrites history",
    severity: "critical",
  },
  {
    pattern: "git\\s+reset\\s+--hard",
    description: "Hard reset discards changes",
    severity: "warn",
  },
  { pattern: "git\\s+clean\\s+-[fdx]+", description: "Git clean removes files", severity: "warn" },
  { pattern: "git\\s+branch\\s+-D", description: "Force branch deletion", severity: "warn" },

  // System modification
  { pattern: "chmod\\s+777", description: "World-writable permissions", severity: "warn" },
  { pattern: "chown\\s+-R\\s+", description: "Recursive ownership change", severity: "warn" },
  { pattern: "sudo\\s+rm", description: "Sudo removal", severity: "critical" },

  // Container/infra destruction
  {
    pattern: "docker\\s+(rm|rmi)\\s+-f",
    description: "Force container/image removal",
    severity: "warn",
  },
  { pattern: "docker\\s+system\\s+prune", description: "Docker system prune", severity: "warn" },
  { pattern: "kubectl\\s+delete", description: "Kubernetes resource deletion", severity: "warn" },

  // Network/security
  { pattern: "iptables\\s+-F", description: "Firewall flush", severity: "critical" },
  { pattern: "ufw\\s+disable", description: "Firewall disable", severity: "critical" },

  // Package management (potentially destructive)
  { pattern: "npm\\s+unpublish", description: "NPM unpublish", severity: "critical" },
  { pattern: "pip\\s+uninstall\\s+-y", description: "Force pip uninstall", severity: "warn" },
] as const;

/**
 * Gets the action tier for a tool.
 */
export function getToolTier(toolName: string): ActionTierClassification {
  const normalized = toolName.trim().toLowerCase();
  const entry = TOOL_TIER_MAP[normalized];

  if (entry) {
    return {
      tool: normalized,
      tier: entry.tier,
      reason: entry.reason,
    };
  }

  // Default unknown tools to write tier (requires approval)
  return {
    tool: normalized,
    tier: "write",
    reason: "Unknown tool defaults to write tier",
  };
}

/**
 * Checks if a shell command contains destructive patterns.
 */
export function detectDestructiveCommand(command: string): {
  isDestructive: boolean;
  matches: Array<{ pattern: string; description: string; severity: string }>;
} {
  const matches: Array<{ pattern: string; description: string; severity: string }> = [];

  for (const { pattern, description, severity } of DESTRUCTIVE_COMMAND_PATTERNS) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(command)) {
      matches.push({ pattern, description, severity });
    }
  }

  return {
    isDestructive: matches.length > 0,
    matches,
  };
}

/**
 * Gets all tools in a specific tier.
 */
export function getToolsInTier(tier: ActionTier): string[] {
  return Object.entries(TOOL_TIER_MAP)
    .filter(([_, entry]) => entry.tier === tier)
    .map(([tool]) => tool);
}

/**
 * Tool groups by tier for use in tool-policy.ts.
 */
export const TIER_TOOL_GROUPS = {
  "group:read": getToolsInTier("read"),
  "group:write": getToolsInTier("write"),
  "group:destructive": getToolsInTier("destructive"),
} as const;
