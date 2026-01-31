import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  checkDestructiveCommand,
  guardDestructiveCommand,
  getDestructivePatterns,
} from "./destructive-guard.js";

// Mock the audit log to avoid file writes
vi.mock("./audit-log.js", () => ({
  logDestructiveBlocked: vi.fn(),
  logTierDecision: vi.fn(),
}));

describe("destructive-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkDestructiveCommand", () => {
    const baseOptions = {
      command: "",
      sessionKey: "test-session",
      toolCallId: "test-call-id",
    };

    describe("with safe commands", () => {
      it("allows non-destructive commands", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "ls -la",
        });
        expect(result.allowed).toBe(true);
        expect(result.requiresApproval).toBe(false);
        expect(result.matches).toHaveLength(0);
      });

      it("allows git status", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "git status",
        });
        expect(result.allowed).toBe(true);
      });
    });

    describe("with destructive commands (default deny policy)", () => {
      it("blocks rm -rf", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "rm -rf /tmp/test",
        });
        expect(result.allowed).toBe(false);
        expect(result.requiresApproval).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
        expect(result.maxSeverity).toBe("critical");
      });

      it("blocks DROP TABLE", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "DROP TABLE users;",
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("blocked");
      });

      it("blocks git push --force", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "git push --force origin main",
        });
        expect(result.allowed).toBe(false);
        expect(result.matches[0].description).toContain("Force push");
      });
    });

    describe("with ask policy", () => {
      it("requires approval for destructive commands", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "rm -rf /tmp/test",
          policyOverride: "ask",
        });
        expect(result.allowed).toBe(false);
        expect(result.requiresApproval).toBe(true);
        expect(result.reason).toContain("requires approval");
      });
    });

    describe("with allow policy", () => {
      it("allows destructive commands", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "rm -rf /tmp/test",
          policyOverride: "allow",
        });
        expect(result.allowed).toBe(true);
        expect(result.requiresApproval).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0); // Still detects patterns
      });
    });

    describe("with elevated mode", () => {
      it("bypasses destructive guard in elevated mode", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "rm -rf /tmp/test",
          elevated: true,
        });
        expect(result.allowed).toBe(true);
        expect(result.requiresApproval).toBe(false);
        expect(result.reason).toContain("Elevated mode");
      });
    });

    describe("with config", () => {
      it("uses config policy when set", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "rm -rf /tmp/test",
          config: {
            enabled: true,
            policy: {
              destructive: "ask",
            },
          },
        });
        expect(result.allowed).toBe(false);
        expect(result.requiresApproval).toBe(true);
      });

      it("policy override takes precedence over config", () => {
        const result = checkDestructiveCommand({
          ...baseOptions,
          command: "rm -rf /tmp/test",
          config: {
            enabled: true,
            policy: {
              destructive: "deny",
            },
          },
          policyOverride: "allow",
        });
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe("guardDestructiveCommand", () => {
    const baseOptions = {
      command: "",
      sessionKey: "test-session",
      toolCallId: "test-call-id",
    };

    it("logs blocked commands to audit log", async () => {
      const { logDestructiveBlocked } = await import("./audit-log.js");

      guardDestructiveCommand({
        ...baseOptions,
        command: "rm -rf /important",
        agentId: "test-agent",
      });

      expect(logDestructiveBlocked).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "test-session",
          agentId: "test-agent",
          tool: "exec",
          toolCallId: "test-call-id",
          command: "rm -rf /important",
        }),
      );
    });

    it("does not log allowed commands", async () => {
      const { logDestructiveBlocked } = await import("./audit-log.js");

      guardDestructiveCommand({
        ...baseOptions,
        command: "ls -la",
      });

      expect(logDestructiveBlocked).not.toHaveBeenCalled();
    });

    it("logs tier decisions when audit is enabled", async () => {
      const { logTierDecision } = await import("./audit-log.js");

      guardDestructiveCommand({
        ...baseOptions,
        command: "rm -rf /tmp",
        config: {
          enabled: true,
          auditTierDecisions: true,
        },
      });

      expect(logTierDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "test-session",
          tool: "exec",
          tier: "destructive",
          decision: "deny",
        }),
      );
    });
  });

  describe("getDestructivePatterns", () => {
    it("returns all patterns", () => {
      const patterns = getDestructivePatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty("pattern");
      expect(patterns[0]).toHaveProperty("description");
      expect(patterns[0]).toHaveProperty("severity");
    });

    it("includes critical patterns", () => {
      const patterns = getDestructivePatterns();
      const critical = patterns.filter((p) => p.severity === "critical");
      expect(critical.length).toBeGreaterThan(0);
    });

    it("includes warn patterns", () => {
      const patterns = getDestructivePatterns();
      const warn = patterns.filter((p) => p.severity === "warn");
      expect(warn.length).toBeGreaterThan(0);
    });
  });
});
