/**
 * Destructive command guard for shell execution.
 *
 * Detects and optionally blocks destructive commands before execution.
 * Integrates with the audit log for security monitoring.
 */

import type { TieredPermissionsConfig, ActionTierPolicy } from "../config/types.action-tiers.js";
import {
  detectDestructiveCommand,
  DESTRUCTIVE_COMMAND_PATTERNS,
} from "../agents/tool-action-tiers.js";
import { logDestructiveBlocked, logTierDecision } from "./audit-log.js";

export type DestructiveGuardResult = {
  /** Whether the command should be allowed to proceed */
  allowed: boolean;
  /** Whether the command requires additional approval */
  requiresApproval: boolean;
  /** Reason for the decision */
  reason: string;
  /** Matched destructive patterns (if any) */
  matches: Array<{ pattern: string; description: string; severity: string }>;
  /** Severity of the highest match */
  maxSeverity?: "warn" | "critical";
};

export type DestructiveGuardOptions = {
  /** The command to check */
  command: string;
  /** Session key for audit logging */
  sessionKey: string;
  /** Agent ID for audit logging */
  agentId?: string;
  /** Tool call ID for audit logging */
  toolCallId: string;
  /** Tiered permissions configuration */
  config?: TieredPermissionsConfig;
  /** Override policy for destructive tier */
  policyOverride?: ActionTierPolicy["destructive"];
  /** Whether the command is running in elevated mode */
  elevated?: boolean;
};

/**
 * Default policy for destructive commands.
 */
const DEFAULT_DESTRUCTIVE_POLICY: ActionTierPolicy["destructive"] = "deny";

/**
 * Checks a command against destructive patterns and returns a guard result.
 */
export function checkDestructiveCommand(options: DestructiveGuardOptions): DestructiveGuardResult {
  const { command, config, policyOverride, elevated } = options;

  // Detect destructive patterns in the command
  const detection = detectDestructiveCommand(command);

  // If no destructive patterns found, allow the command
  if (!detection.isDestructive) {
    return {
      allowed: true,
      requiresApproval: false,
      reason: "No destructive patterns detected",
      matches: [],
    };
  }

  // Determine the effective policy
  const configuredPolicy = config?.policy?.destructive;
  const effectivePolicy = policyOverride ?? configuredPolicy ?? DEFAULT_DESTRUCTIVE_POLICY;

  // Elevated mode bypasses destructive checks (user explicitly approved)
  if (elevated) {
    return {
      allowed: true,
      requiresApproval: false,
      reason: "Elevated mode bypasses destructive guard",
      matches: detection.matches,
      maxSeverity: getMaxSeverity(detection.matches),
    };
  }

  // Determine max severity
  const maxSeverity = getMaxSeverity(detection.matches);

  // Apply policy
  switch (effectivePolicy) {
    case "allow":
      return {
        allowed: true,
        requiresApproval: false,
        reason: "Policy allows destructive commands",
        matches: detection.matches,
        maxSeverity,
      };

    case "ask":
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Destructive command requires approval: ${detection.matches.map((m) => m.description).join(", ")}`,
        matches: detection.matches,
        maxSeverity,
      };

    case "deny":
    default:
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Destructive command blocked: ${detection.matches.map((m) => m.description).join(", ")}`,
        matches: detection.matches,
        maxSeverity,
      };
  }
}

/**
 * Gets the maximum severity from a list of matches.
 */
function getMaxSeverity(matches: Array<{ severity: string }>): "warn" | "critical" | undefined {
  if (matches.length === 0) {
    return undefined;
  }
  return matches.some((m) => m.severity === "critical") ? "critical" : "warn";
}

/**
 * Guards a command execution against destructive patterns.
 *
 * Returns a result indicating whether the command should proceed.
 * Logs to the audit log if the command is blocked.
 */
export function guardDestructiveCommand(options: DestructiveGuardOptions): DestructiveGuardResult {
  const result = checkDestructiveCommand(options);

  // Log blocked commands to audit log
  if (!result.allowed && !result.requiresApproval && result.matches.length > 0) {
    logDestructiveBlocked({
      sessionKey: options.sessionKey,
      agentId: options.agentId,
      tool: "exec",
      toolCallId: options.toolCallId,
      command: options.command,
      patterns: result.matches,
    });
  }

  // Log tier decisions if audit is enabled
  if (options.config?.auditTierDecisions) {
    const decision = result.allowed ? "allow" : result.requiresApproval ? "ask" : "deny";
    logTierDecision({
      sessionKey: options.sessionKey,
      agentId: options.agentId,
      tool: "exec",
      toolCallId: options.toolCallId,
      tier: "destructive",
      decision,
      reason: result.reason,
    });
  }

  return result;
}

/** Custom patterns added at runtime */
const customPatterns: Array<{ pattern: string; description: string; severity: string }> = [];

/**
 * Adds custom destructive patterns to the detection.
 */
export function extendDestructivePatterns(
  patterns: Array<{ pattern: string; description: string; severity: "warn" | "critical" }>,
): void {
  for (const pattern of patterns) {
    const exists =
      DESTRUCTIVE_COMMAND_PATTERNS.some((p) => p.pattern === pattern.pattern) ||
      customPatterns.some((p) => p.pattern === pattern.pattern);
    if (!exists) {
      customPatterns.push(pattern);
    }
  }
}

/**
 * Gets all destructive command patterns (built-in + custom).
 */
export function getDestructivePatterns(): ReadonlyArray<{
  pattern: string;
  description: string;
  severity: string;
}> {
  return [...DESTRUCTIVE_COMMAND_PATTERNS, ...customPatterns];
}
