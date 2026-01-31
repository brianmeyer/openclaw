/**
 * Action tier types for tiered permission system.
 *
 * Implements Composio-inspired action-level control:
 * - read: Always allowed (safe observation)
 * - write: Requires approval (modifies state)
 * - destructive: Blocked by default (irreversible/dangerous)
 *
 * @see https://docs.composio.dev/guides/security
 */

/**
 * Action tier levels ordered by risk.
 *
 * - `read`: Safe operations that only observe state (file reads, searches, fetches)
 * - `write`: Operations that modify state but are reversible (file writes, edits, sends)
 * - `destructive`: Irreversible or high-risk operations (rm -rf, DROP TABLE, force push)
 */
export type ActionTier = "read" | "write" | "destructive";

/**
 * Classification of a tool action.
 */
export type ActionTierClassification = {
  /** The tool name (canonical lowercase) */
  tool: string;
  /** The tier level */
  tier: ActionTier;
  /** Human-readable reason for classification */
  reason: string;
};

/**
 * Policy for how to handle each action tier.
 */
export type ActionTierPolicy = {
  /** Read tier policy (default: allow) */
  read?: "allow" | "ask" | "deny";
  /** Write tier policy (default: ask) */
  write?: "allow" | "ask" | "deny";
  /** Destructive tier policy (default: deny) */
  destructive?: "allow" | "ask" | "deny";
};

/**
 * Destructive command patterns for shell/exec detection.
 *
 * These patterns identify commands that could cause irreversible damage.
 */
export type DestructiveCommandPattern = {
  /** Pattern to match (regex source) */
  pattern: string;
  /** Human-readable description */
  description: string;
  /** Severity level */
  severity: "warn" | "critical";
};

/**
 * Configuration for tiered permission enforcement.
 */
export type TieredPermissionsConfig = {
  /** Enable tiered permissions (default: false for backward compat) */
  enabled?: boolean;
  /** Policy for each tier */
  policy?: ActionTierPolicy;
  /** Custom destructive patterns to add */
  extraDestructivePatterns?: DestructiveCommandPattern[];
  /** Log tier decisions to audit log */
  auditTierDecisions?: boolean;
};
