/**
 * Security tools for OpenClaw agents.
 *
 * Provides tools for security auditing, monitoring, and hardening
 * following the RAK framework (Root, Agency, Keys risks).
 */

import path from "node:path";

import { Type } from "@sinclair/typebox";

import type { OpenClawConfig } from "../../config/config.js";
import { resolveStateDir } from "../../config/paths.js";
import { runSecurityAudit } from "../../security/audit.js";
import { fixSecurityFootguns } from "../../security/fix.js";
import { analyzeAuditLog } from "../../security/audit-log-analysis.js";
import { scanSkill, scanAllSkills, summarizeScanResults } from "../../security/skill-scanner.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

// ============================================================================
// Tool Schemas
// ============================================================================

const SecurityAuditSchema = Type.Object({
  deep: Type.Optional(Type.Boolean()),
});

const SecurityFixSchema = Type.Object({
  // No parameters - fix applies all safe remediations
});

const SecurityMonitorSchema = Type.Object({
  hours: Type.Optional(Type.Number()),
});

const SecurityScanSkillsSchema = Type.Object({
  path: Type.Optional(Type.String()),
});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Creates the security_audit tool.
 */
export function createSecurityAuditTool(options: {
  config: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
}): AnyAgentTool {
  const { config, env = process.env } = options;

  return {
    label: "Security Audit",
    name: "security_audit",
    description:
      "Run a comprehensive security audit following the RAK framework. " +
      "Checks gateway exposure, file permissions, channel policies, credential handling, and more. " +
      "Use deep:true to also probe the gateway connection.",
    parameters: SecurityAuditSchema,
    execute: async (_toolCallId, params) => {
      const deep = Boolean(params.deep);

      try {
        const report = await runSecurityAudit({
          config,
          env,
          deep,
          includeFilesystem: true,
          includeChannelSecurity: true,
        });

        // Format findings for readability
        const formattedFindings = report.findings.map((f) => ({
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          ...(f.remediation ? { remediation: f.remediation } : {}),
        }));

        return jsonResult({
          summary: report.summary,
          findings: formattedFindings,
          deep: report.deep,
          timestamp: new Date(report.ts).toISOString(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ error: message });
      }
    },
  };
}

/**
 * Creates the security_fix tool.
 *
 * This tool modifies configuration and file permissions, so it requires
 * user approval before execution.
 */
export function createSecurityFixTool(options: {
  config: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
}): AnyAgentTool {
  const { env = process.env } = options;

  return {
    label: "Security Fix",
    name: "security_fix",
    description:
      "Auto-remediate common security footguns. " +
      "Fixes file permissions (config 0600, state dir 0700), " +
      "enables logging.redactSensitive if disabled, " +
      "and converts groupPolicy='open' to 'allowlist'. " +
      "IMPORTANT: This modifies your configuration and file permissions.",
    parameters: SecurityFixSchema,
    execute: async (_toolCallId, _params) => {
      try {
        const result = await fixSecurityFootguns({ env });

        // Summarize actions
        const successfulActions = result.actions.filter((a) => a.ok);
        const skippedActions = result.actions.filter((a) => a.skipped);
        const failedActions = result.actions.filter((a) => a.error);

        return jsonResult({
          ok: result.ok,
          configWritten: result.configWritten,
          changes: result.changes,
          actions: {
            successful: successfulActions.length,
            skipped: skippedActions.length,
            failed: failedActions.length,
          },
          errors: result.errors.length > 0 ? result.errors : undefined,
          details: result.actions.map((a) => ({
            path: a.path,
            ok: a.ok,
            ...(a.skipped ? { skipped: a.skipped } : {}),
            ...(a.error ? { error: a.error } : {}),
          })),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ error: message });
      }
    },
  };
}

/**
 * Creates the security_monitor tool.
 */
export function createSecurityMonitorTool(_options: {
  config: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
}): AnyAgentTool {
  return {
    label: "Security Monitor",
    name: "security_monitor",
    description:
      "Analyze tool audit logs for security anomalies. " +
      "Detects high error rates, bursts of sensitive tool calls, " +
      "policy denial patterns, and potential data exfiltration. " +
      "Default window is 24 hours; use hours param to adjust.",
    parameters: SecurityMonitorSchema,
    execute: async (_toolCallId, params) => {
      const hours = readNumberParam(params, "hours") ?? 24;
      const windowMs = hours * 60 * 60 * 1000;

      try {
        const analysis = await analyzeAuditLog({ windowMs });

        return jsonResult({
          period: {
            hours,
            start: analysis.period.start,
            end: analysis.period.end,
          },
          stats: {
            totalCalls: analysis.totalCalls,
            totalErrors: analysis.totalErrors,
            errorRate: `${Math.round(analysis.errorRate * 100)}%`,
            uniqueSessions: analysis.uniqueSessions,
          },
          anomalies: analysis.anomalies,
          topTools: Object.entries(analysis.toolBreakdown)
            .toSorted((a, b) => b[1].calls - a[1].calls)
            .slice(0, 10)
            .map(([tool, stats]) => ({
              tool,
              calls: stats.calls,
              errors: stats.errors,
              errorRate:
                stats.calls > 0 ? `${Math.round((stats.errors / stats.calls) * 100)}%` : "0%",
            })),
          logPath: analysis.logPath,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ error: message });
      }
    },
  };
}

/**
 * Creates the security_scan_skills tool.
 */
export function createSecurityScanSkillsTool(options: {
  config: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
}): AnyAgentTool {
  const { env = process.env } = options;
  const stateDir = resolveStateDir(env);

  return {
    label: "Security Scan Skills",
    name: "security_scan_skills",
    description:
      "Scan skills for security issues including prompt injection, " +
      "data exfiltration patterns, suspicious commands, and credential access. " +
      "By default scans all workspace skills; use path param for a specific skill.",
    parameters: SecurityScanSkillsSchema,
    execute: async (_toolCallId, params) => {
      const skillPath = readStringParam(params, "path");

      try {
        if (skillPath) {
          // Scan single skill
          const result = await scanSkill(skillPath);
          return jsonResult({
            scanned: 1,
            results: [result],
          });
        }

        // Scan all skills in workspace
        const workspaceSkillsDir = path.join(stateDir, "skills");
        const results = await scanAllSkills(workspaceSkillsDir);
        const summary = summarizeScanResults(results);

        return jsonResult({
          summary,
          results: results.map((r) => ({
            skill: r.skillName ?? path.basename(r.skillPath),
            safe: r.safe,
            findings: r.findings.length,
            critical: r.findings.filter((f) => f.severity === "critical").length,
            warn: r.findings.filter((f) => f.severity === "warn").length,
            ...(r.findings.length > 0
              ? {
                  details: r.findings.map((f) => ({
                    severity: f.severity,
                    kind: f.kind,
                    detail: f.detail,
                    ...(f.line ? { line: f.line } : {}),
                  })),
                }
              : {}),
          })),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ error: message });
      }
    },
  };
}

// ============================================================================
// Tool Factory
// ============================================================================

/**
 * Creates all security tools.
 */
export function createSecurityTools(options: {
  config: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
}): AnyAgentTool[] {
  return [
    createSecurityAuditTool(options),
    createSecurityFixTool(options),
    createSecurityMonitorTool(options),
    createSecurityScanSkillsTool(options),
  ];
}
