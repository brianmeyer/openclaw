/**
 * Security audit logging for tool actions.
 *
 * Provides structured logging of tool executions for security monitoring
 * and incident investigation. Logs are written in JSON Lines format.
 */

import fs from "node:fs";
import path from "node:path";

import { STATE_DIR } from "../config/config.js";
import { redactSensitiveText } from "../logging/redact.js";

/** Directory for audit logs */
const AUDIT_LOG_DIR = path.join(
  STATE_DIR ?? path.join(process.env.HOME ?? "", ".openclaw"),
  "logs",
);

/** Audit log file path */
const AUDIT_LOG_PATH = path.join(AUDIT_LOG_DIR, "tool-audit.jsonl");

/** Maximum size of individual log entries (prevents memory issues) */
const MAX_ENTRY_SIZE = 10_000;

export type ToolAuditEntry = {
  /** ISO timestamp */
  timestamp: string;
  /** Event type */
  event: "tool_call" | "tool_result" | "tool_error";
  /** Session identifier */
  sessionKey: string;
  /** Agent identifier if available */
  agentId?: string;
  /** Tool name */
  tool: string;
  /** Tool call ID */
  toolCallId: string;
  /** Redacted arguments (sensitive values masked) */
  args?: Record<string, unknown>;
  /** Result status */
  status?: "success" | "error";
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  durationMs?: number;
  /** Whether approval was required */
  approvalRequired?: boolean;
  /** Whether approval was granted */
  approvalGranted?: boolean;
};

let initialized = false;

/**
 * Ensures the audit log directory exists.
 */
function ensureLogDir(): void {
  if (initialized) {
    return;
  }
  try {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true, mode: 0o700 });
    initialized = true;
  } catch (err) {
    console.error("Failed to create audit log directory:", err);
  }
}

/**
 * Truncates a string to a maximum length.
 */
function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

/**
 * Redacts sensitive values from tool arguments.
 */
function redactArgs(args: unknown): Record<string, unknown> | undefined {
  if (!args || typeof args !== "object") {
    return undefined;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (typeof value === "string") {
      result[key] = truncate(redactSensitiveText(value, { mode: "tools" }), 500);
    } else if (typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else if (value === null) {
      result[key] = null;
    } else {
      // For complex types, just note the type
      result[key] = `[${typeof value}]`;
    }
  }
  return result;
}

/**
 * Writes an audit log entry.
 */
export function writeAuditEntry(entry: ToolAuditEntry): void {
  ensureLogDir();

  try {
    const line = JSON.stringify(entry);
    const truncatedLine = truncate(line, MAX_ENTRY_SIZE);
    fs.appendFileSync(AUDIT_LOG_PATH, `${truncatedLine}\n`, { mode: 0o600 });
  } catch (err) {
    // Silently fail - audit logging should not break the application
    console.error("Failed to write audit log entry:", err);
  }
}

/**
 * Logs a tool call event.
 */
export function logToolCall(params: {
  sessionKey: string;
  agentId?: string;
  tool: string;
  toolCallId: string;
  args?: unknown;
  approvalRequired?: boolean;
  approvalGranted?: boolean;
}): void {
  writeAuditEntry({
    timestamp: new Date().toISOString(),
    event: "tool_call",
    sessionKey: params.sessionKey,
    agentId: params.agentId,
    tool: params.tool,
    toolCallId: params.toolCallId,
    args: redactArgs(params.args),
    approvalRequired: params.approvalRequired,
    approvalGranted: params.approvalGranted,
  });
}

/**
 * Logs a tool result event.
 */
export function logToolResult(params: {
  sessionKey: string;
  agentId?: string;
  tool: string;
  toolCallId: string;
  status: "success" | "error";
  error?: string;
  durationMs?: number;
}): void {
  writeAuditEntry({
    timestamp: new Date().toISOString(),
    event: "tool_result",
    sessionKey: params.sessionKey,
    agentId: params.agentId,
    tool: params.tool,
    toolCallId: params.toolCallId,
    status: params.status,
    error: params.error ? truncate(params.error, 500) : undefined,
    durationMs: params.durationMs,
  });
}

/**
 * Logs a tool error event.
 */
export function logToolError(params: {
  sessionKey: string;
  agentId?: string;
  tool: string;
  toolCallId: string;
  error: string;
}): void {
  writeAuditEntry({
    timestamp: new Date().toISOString(),
    event: "tool_error",
    sessionKey: params.sessionKey,
    agentId: params.agentId,
    tool: params.tool,
    toolCallId: params.toolCallId,
    status: "error",
    error: truncate(params.error, 500),
  });
}

/**
 * Gets the audit log file path.
 */
export function getAuditLogPath(): string {
  return AUDIT_LOG_PATH;
}
