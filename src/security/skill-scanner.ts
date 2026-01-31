/**
 * Security scanner for OpenClaw skills.
 *
 * Scans SKILL.md files for suspicious patterns that may indicate
 * prompt injection, data exfiltration, or malicious behavior.
 *
 * Inspired by Cisco's skill-scanner: https://github.com/cisco-ai-defense/skill-scanner
 */

import fs from "node:fs/promises";
import path from "node:path";

import { detectSuspiciousPatterns } from "./external-content.js";

/** Additional patterns specific to skill files (beyond external-content.ts) */
const SKILL_SPECIFIC_PATTERNS: Array<{
  pattern: RegExp;
  kind: SkillFindingKind;
  severity: SkillFindingSeverity;
  description: string;
}> = [
  // Data exfiltration patterns
  {
    pattern: /curl\s+.*\|\s*base64/i,
    kind: "data_exfil",
    severity: "critical",
    description: "Potential data exfiltration via curl with base64 encoding",
  },
  {
    pattern: /nc\s+-e\s+/i,
    kind: "data_exfil",
    severity: "critical",
    description: "Netcat with execute flag - potential reverse shell",
  },
  {
    pattern: /curl\s+.*-d\s+.*\$\(/i,
    kind: "data_exfil",
    severity: "warn",
    description: "Curl POST with command substitution - potential data exfil",
  },
  {
    pattern: /webhook\.site|requestbin\.com|pipedream\.com/i,
    kind: "data_exfil",
    severity: "warn",
    description: "Reference to known webhook testing service",
  },

  // Suspicious command patterns
  {
    pattern: /chmod\s+777/i,
    kind: "suspicious_command",
    severity: "warn",
    description: "Setting world-writable permissions",
  },
  {
    pattern: /sudo\s+(rm|chmod|chown|dd)/i,
    kind: "suspicious_command",
    severity: "warn",
    description: "Sudo with potentially destructive command",
  },
  {
    pattern: /eval\s*\(\s*\$|eval\s+"\$/i,
    kind: "suspicious_command",
    severity: "critical",
    description: "Eval with variable expansion - potential code injection",
  },
  {
    pattern: /\$\(.*curl.*\)/i,
    kind: "suspicious_command",
    severity: "critical",
    description: "Command substitution with curl - potential remote code execution",
  },

  // Unsafe tool usage
  {
    pattern: /elevated\s*:\s*true/i,
    kind: "unsafe_tool",
    severity: "warn",
    description: "Skill requests elevated execution",
  },
  {
    pattern: /sandbox\s*:\s*false/i,
    kind: "unsafe_tool",
    severity: "warn",
    description: "Skill disables sandboxing",
  },
  {
    pattern: /approval\s*:\s*false|auto.?approve/i,
    kind: "unsafe_tool",
    severity: "warn",
    description: "Skill may bypass approval mechanisms",
  },

  // Credential access patterns
  {
    pattern: /\.(env|credentials|secrets?|key|pem|p12|pfx)\b/i,
    kind: "credential_access",
    severity: "info",
    description: "Reference to potential credential file",
  },
  {
    pattern: /AWS_SECRET|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN/i,
    kind: "credential_access",
    severity: "warn",
    description: "Reference to sensitive environment variable",
  },
  {
    pattern: /cat\s+.*\/\.(ssh|gnupg|aws|config)/i,
    kind: "credential_access",
    severity: "critical",
    description: "Attempting to read sensitive dotfiles",
  },

  // Unsafe URLs
  {
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/i,
    kind: "unsafe_url",
    severity: "info",
    description: "Non-HTTPS URL (potential data exposure)",
  },
  {
    pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+/,
    kind: "unsafe_url",
    severity: "info",
    description: "Direct IP:port reference",
  },
];

export type SkillFindingKind =
  | "prompt_injection"
  | "data_exfil"
  | "suspicious_command"
  | "unsafe_tool"
  | "credential_access"
  | "unsafe_url";

export type SkillFindingSeverity = "info" | "warn" | "critical";

export type SkillScanFinding = {
  kind: SkillFindingKind;
  severity: SkillFindingSeverity;
  line?: number;
  detail: string;
  pattern: string;
  context?: string;
};

export type SkillScanResult = {
  skillPath: string;
  skillName?: string;
  safe: boolean;
  findings: SkillScanFinding[];
  scannedAt: string;
};

/**
 * Extracts the skill name from SKILL.md frontmatter.
 */
function extractSkillName(content: string): string | undefined {
  const match = content.match(/^---\s*\n[\s\S]*?name:\s*["']?([^"'\n]+)/m);
  return match?.[1]?.trim();
}

/**
 * Scans a single skill file for security issues.
 */
export async function scanSkill(skillPath: string): Promise<SkillScanResult> {
  const findings: SkillScanFinding[] = [];
  const scannedAt = new Date().toISOString();

  // Resolve to SKILL.md if directory provided
  let filePath = skillPath;
  try {
    const stat = await fs.stat(skillPath);
    if (stat.isDirectory()) {
      filePath = path.join(skillPath, "SKILL.md");
    }
  } catch {
    return {
      skillPath,
      safe: false,
      findings: [
        {
          kind: "suspicious_command",
          severity: "warn",
          detail: `Could not access skill path: ${skillPath}`,
          pattern: "N/A",
        },
      ],
      scannedAt,
    };
  }

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    return {
      skillPath,
      safe: false,
      findings: [
        {
          kind: "suspicious_command",
          severity: "warn",
          detail: `Could not read skill file: ${filePath}`,
          pattern: "N/A",
        },
      ],
      scannedAt,
    };
  }

  const skillName = extractSkillName(content);
  const lines = content.split("\n");

  // Check for prompt injection patterns (from external-content.ts)
  const injectionPatterns = detectSuspiciousPatterns(content);
  for (const patternSource of injectionPatterns) {
    // Find the line number
    const pattern = new RegExp(patternSource, "i");
    let lineNum: number | undefined;
    let context: string | undefined;
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        lineNum = i + 1;
        context = lines[i].trim().slice(0, 100);
        break;
      }
    }

    findings.push({
      kind: "prompt_injection",
      severity: "critical",
      line: lineNum,
      detail: "Potential prompt injection pattern detected",
      pattern: patternSource,
      context,
    });
  }

  // Check skill-specific patterns
  for (const { pattern, kind, severity, description } of SKILL_SPECIFIC_PATTERNS) {
    if (pattern.test(content)) {
      // Find the line number and context
      let lineNum: number | undefined;
      let context: string | undefined;
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          lineNum = i + 1;
          context = lines[i].trim().slice(0, 100);
          break;
        }
      }

      findings.push({
        kind,
        severity,
        line: lineNum,
        detail: description,
        pattern: pattern.source,
        context,
      });
    }
  }

  // Sort findings by severity
  const severityOrder: Record<SkillFindingSeverity, number> = { critical: 0, warn: 1, info: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Determine if skill is safe (no critical or warn findings)
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasWarn = findings.some((f) => f.severity === "warn");

  return {
    skillPath,
    skillName,
    safe: !hasCritical && !hasWarn,
    findings,
    scannedAt,
  };
}

/**
 * Scans all skills in a directory.
 */
export async function scanAllSkills(skillsDir: string): Promise<SkillScanResult[]> {
  const results: SkillScanResult[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const skillPath = path.join(skillsDir, entry);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    try {
      const stat = await fs.stat(skillMdPath);
      if (stat.isFile()) {
        const result = await scanSkill(skillPath);
        results.push(result);
      }
    } catch {
      // Not a skill directory, skip
    }
  }

  // Sort by safety (unsafe first) then by name
  results.sort((a, b) => {
    if (a.safe !== b.safe) {
      return a.safe ? 1 : -1;
    }
    return (a.skillName ?? a.skillPath).localeCompare(b.skillName ?? b.skillPath);
  });

  return results;
}

/**
 * Gets a summary of scan results.
 */
export function summarizeScanResults(results: SkillScanResult[]): {
  total: number;
  safe: number;
  unsafe: number;
  criticalFindings: number;
  warnFindings: number;
  infoFindings: number;
} {
  let criticalFindings = 0;
  let warnFindings = 0;
  let infoFindings = 0;

  for (const result of results) {
    for (const finding of result.findings) {
      if (finding.severity === "critical") {
        criticalFindings++;
      } else if (finding.severity === "warn") {
        warnFindings++;
      } else {
        infoFindings++;
      }
    }
  }

  return {
    total: results.length,
    safe: results.filter((r) => r.safe).length,
    unsafe: results.filter((r) => !r.safe).length,
    criticalFindings,
    warnFindings,
    infoFindings,
  };
}
