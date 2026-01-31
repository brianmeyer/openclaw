/**
 * Security analysis for tool audit logs.
 *
 * Analyzes audit logs to detect anomalies and suspicious patterns
 * following MITRE ATLAS techniques for AI agent security.
 */

import fs from "node:fs";
import readline from "node:readline";

import type { ToolAuditEntry } from "./audit-log.js";
import { getAuditLogPath } from "./audit-log.js";

/** Sensitive tools that warrant extra monitoring */
const SENSITIVE_TOOLS = new Set([
  "bash",
  "exec",
  "elevated_exec",
  "process",
  "write",
  "edit",
  "nodes_run",
  "browser_action",
]);

/** Tools that could exfiltrate data */
const EXFIL_TOOLS = new Set(["web_fetch", "send", "webhook", "email"]);

/** Thresholds for anomaly detection */
const THRESHOLDS = {
  /** Error rate above this triggers warning */
  highErrorRate: 0.2,
  /** Sensitive tool calls in a 5-minute window to trigger alert */
  sensitiveBurstCount: 10,
  /** Window size for burst detection (ms) */
  burstWindowMs: 5 * 60 * 1000,
  /** Minimum calls before calculating error rate */
  minCallsForErrorRate: 10,
};

export type AuditAnomaly = {
  kind:
    | "high_error_rate"
    | "sensitive_burst"
    | "unusual_tool"
    | "denied_attempt"
    | "exfil_pattern"
    | "rapid_fire";
  severity: "info" | "warn" | "critical";
  detail: string;
  timestamp?: string;
  tool?: string;
  count?: number;
};

export type ToolStats = {
  calls: number;
  errors: number;
  denials: number;
  lastCall?: string;
};

export type AuditLogAnalysis = {
  /** Analysis time window */
  period: {
    start: string;
    end: string;
    durationMs: number;
  };
  /** Total tool calls analyzed */
  totalCalls: number;
  /** Total errors */
  totalErrors: number;
  /** Overall error rate */
  errorRate: number;
  /** Breakdown by tool */
  toolBreakdown: Record<string, ToolStats>;
  /** Detected anomalies */
  anomalies: AuditAnomaly[];
  /** Sessions seen */
  uniqueSessions: number;
  /** Log file path */
  logPath: string;
};

/**
 * Parses a JSON Lines audit log file.
 */
async function parseAuditLog(logPath: string, windowMs: number): Promise<ToolAuditEntry[]> {
  const entries: ToolAuditEntry[] = [];
  const cutoff = Date.now() - windowMs;

  if (!fs.existsSync(logPath)) {
    return entries;
  }

  const stream = fs.createReadStream(logPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    try {
      const entry = JSON.parse(line) as ToolAuditEntry;
      const ts = new Date(entry.timestamp).getTime();
      if (ts >= cutoff) {
        entries.push(entry);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Detects bursts of sensitive tool calls.
 */
function detectSensitiveBursts(entries: ToolAuditEntry[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];
  const sensitiveEntries = entries.filter(
    (e) => e.event === "tool_call" && SENSITIVE_TOOLS.has(e.tool),
  );

  if (sensitiveEntries.length < THRESHOLDS.sensitiveBurstCount) {
    return anomalies;
  }

  // Sort by timestamp
  sensitiveEntries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Sliding window detection
  for (let i = 0; i <= sensitiveEntries.length - THRESHOLDS.sensitiveBurstCount; i++) {
    const windowStart = new Date(sensitiveEntries[i].timestamp).getTime();
    const windowEnd = new Date(
      sensitiveEntries[i + THRESHOLDS.sensitiveBurstCount - 1].timestamp,
    ).getTime();

    if (windowEnd - windowStart <= THRESHOLDS.burstWindowMs) {
      const toolsInBurst = new Set(
        sensitiveEntries.slice(i, i + THRESHOLDS.sensitiveBurstCount).map((e) => e.tool),
      );
      anomalies.push({
        kind: "sensitive_burst",
        severity: "critical",
        detail: `${THRESHOLDS.sensitiveBurstCount}+ sensitive tool calls in ${Math.round((windowEnd - windowStart) / 1000)}s: ${[...toolsInBurst].join(", ")}`,
        timestamp: sensitiveEntries[i].timestamp,
        count: THRESHOLDS.sensitiveBurstCount,
      });
      // Skip ahead to avoid duplicate alerts
      i += THRESHOLDS.sensitiveBurstCount - 1;
    }
  }

  return anomalies;
}

/**
 * Detects high error rates per tool.
 */
function detectHighErrorRates(toolStats: Record<string, ToolStats>): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  for (const [tool, stats] of Object.entries(toolStats)) {
    if (stats.calls < THRESHOLDS.minCallsForErrorRate) {
      continue;
    }
    const errorRate = stats.errors / stats.calls;
    if (errorRate > THRESHOLDS.highErrorRate) {
      anomalies.push({
        kind: "high_error_rate",
        severity: "warn",
        detail: `Tool "${tool}" has ${Math.round(errorRate * 100)}% error rate (${stats.errors}/${stats.calls} calls)`,
        tool,
        count: stats.errors,
      });
    }
  }

  return anomalies;
}

/**
 * Detects patterns of denied tool attempts.
 */
function detectDenialPatterns(entries: ToolAuditEntry[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];
  const deniedTools: Record<string, number> = {};

  for (const entry of entries) {
    if (entry.event === "tool_call" && entry.approvalGranted === false) {
      deniedTools[entry.tool] = (deniedTools[entry.tool] ?? 0) + 1;
    }
  }

  for (const [tool, count] of Object.entries(deniedTools)) {
    if (count >= 3) {
      anomalies.push({
        kind: "denied_attempt",
        severity: SENSITIVE_TOOLS.has(tool) ? "critical" : "warn",
        detail: `${count} denied attempts for tool "${tool}" - possible privilege escalation probe`,
        tool,
        count,
      });
    }
  }

  return anomalies;
}

/**
 * Detects potential data exfiltration patterns.
 */
function detectExfilPatterns(entries: ToolAuditEntry[]): AuditAnomaly[] {
  const anomalies: AuditAnomaly[] = [];

  // Look for read/fetch followed by send/webhook patterns
  const readTools = new Set(["read", "web_fetch", "bash"]);
  const sessions: Record<string, { reads: number; exfils: number }> = {};

  for (const entry of entries) {
    if (entry.event !== "tool_call") {
      continue;
    }
    const key = entry.sessionKey;
    if (!sessions[key]) {
      sessions[key] = { reads: 0, exfils: 0 };
    }
    if (readTools.has(entry.tool)) {
      sessions[key].reads++;
    }
    if (EXFIL_TOOLS.has(entry.tool)) {
      sessions[key].exfils++;
    }
  }

  for (const [sessionKey, stats] of Object.entries(sessions)) {
    if (stats.reads >= 5 && stats.exfils >= 3) {
      anomalies.push({
        kind: "exfil_pattern",
        severity: "warn",
        detail: `Session "${sessionKey.slice(0, 20)}..." shows read/exfil pattern: ${stats.reads} reads, ${stats.exfils} outbound calls`,
        count: stats.exfils,
      });
    }
  }

  return anomalies;
}

/**
 * Analyzes audit logs for security anomalies.
 */
export async function analyzeAuditLog(opts?: {
  /** Path to audit log file (default: standard location) */
  logPath?: string;
  /** Time window in milliseconds (default: 24 hours) */
  windowMs?: number;
}): Promise<AuditLogAnalysis> {
  const logPath = opts?.logPath ?? getAuditLogPath();
  const windowMs = opts?.windowMs ?? 24 * 60 * 60 * 1000;

  const entries = await parseAuditLog(logPath, windowMs);

  // Calculate statistics
  const toolStats: Record<string, ToolStats> = {};
  const sessions = new Set<string>();
  let totalCalls = 0;
  let totalErrors = 0;
  let earliest: string | undefined;
  let latest: string | undefined;

  for (const entry of entries) {
    sessions.add(entry.sessionKey);

    if (!earliest || entry.timestamp < earliest) {
      earliest = entry.timestamp;
    }
    if (!latest || entry.timestamp > latest) {
      latest = entry.timestamp;
    }

    if (!toolStats[entry.tool]) {
      toolStats[entry.tool] = { calls: 0, errors: 0, denials: 0 };
    }

    if (entry.event === "tool_call") {
      totalCalls++;
      toolStats[entry.tool].calls++;
      toolStats[entry.tool].lastCall = entry.timestamp;

      if (entry.approvalGranted === false) {
        toolStats[entry.tool].denials++;
      }
    }

    if (entry.status === "error" || entry.event === "tool_error") {
      totalErrors++;
      toolStats[entry.tool].errors++;
    }
  }

  // Detect anomalies
  const anomalies: AuditAnomaly[] = [
    ...detectSensitiveBursts(entries),
    ...detectHighErrorRates(toolStats),
    ...detectDenialPatterns(entries),
    ...detectExfilPatterns(entries),
  ];

  // Check overall error rate
  if (totalCalls >= THRESHOLDS.minCallsForErrorRate) {
    const overallErrorRate = totalErrors / totalCalls;
    if (overallErrorRate > THRESHOLDS.highErrorRate) {
      anomalies.push({
        kind: "high_error_rate",
        severity: "warn",
        detail: `Overall error rate is ${Math.round(overallErrorRate * 100)}% (${totalErrors}/${totalCalls} calls)`,
        count: totalErrors,
      });
    }
  }

  // Sort anomalies by severity
  const severityOrder = { critical: 0, warn: 1, info: 2 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const now = new Date().toISOString();
  return {
    period: {
      start: earliest ?? now,
      end: latest ?? now,
      durationMs: windowMs,
    },
    totalCalls,
    totalErrors,
    errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
    toolBreakdown: toolStats,
    anomalies,
    uniqueSessions: sessions.size,
    logPath,
  };
}
