import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAuditLogPath, logToolCall, logToolError, logToolResult } from "./audit-log.js";

/**
 * Parse JSON Lines file and return the last entry.
 */
function parseLastEntry(content: string): Record<string, unknown> {
  const lines = content.trim().split("\n").filter(Boolean);
  if (lines.length === 0) {
    throw new Error("No entries in log file");
  }
  return JSON.parse(lines[lines.length - 1]);
}

describe("audit-log", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-log-test-"));
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = tempDir;
  });

  afterEach(() => {
    if (originalStateDir !== undefined) {
      process.env.OPENCLAW_STATE_DIR = originalStateDir;
    } else {
      delete process.env.OPENCLAW_STATE_DIR;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("logToolCall", () => {
    it("logs tool call with basic info", () => {
      logToolCall({
        sessionKey: "test-session",
        tool: "web_fetch",
        toolCallId: "call-123",
        args: { url: "https://example.com" },
      });

      const logPath = getAuditLogPath();
      const content = fs.readFileSync(logPath, "utf-8");
      const entry = parseLastEntry(content);

      expect(entry.event).toBe("tool_call");
      expect(entry.sessionKey).toBe("test-session");
      expect(entry.tool).toBe("web_fetch");
      expect(entry.toolCallId).toBe("call-123");
      expect(entry.args.url).toBe("https://example.com");
    });

    it("redacts sensitive values in args", () => {
      logToolCall({
        sessionKey: "test-session",
        tool: "exec",
        toolCallId: "call-456",
        args: { command: "API_KEY=sk-1234567890abcdef echo test" },
      });

      const logPath = getAuditLogPath();
      const content = fs.readFileSync(logPath, "utf-8");
      const entry = parseLastEntry(content);

      // Should contain redacted key
      expect(entry.args.command).toContain("sk-123");
      expect(entry.args.command).toContain("…");
      expect(entry.args.command).not.toContain("1234567890abcdef");
    });

    it("includes agent ID when provided", () => {
      logToolCall({
        sessionKey: "test-session",
        agentId: "agent-789",
        tool: "read",
        toolCallId: "call-789",
      });

      const logPath = getAuditLogPath();
      const content = fs.readFileSync(logPath, "utf-8");
      const entry = parseLastEntry(content);

      expect(entry.agentId).toBe("agent-789");
    });

    it("logs approval status", () => {
      logToolCall({
        sessionKey: "test-session",
        tool: "exec",
        toolCallId: "call-approval",
        approvalRequired: true,
        approvalGranted: true,
      });

      const logPath = getAuditLogPath();
      const content = fs.readFileSync(logPath, "utf-8");
      const entry = parseLastEntry(content);

      expect(entry.approvalRequired).toBe(true);
      expect(entry.approvalGranted).toBe(true);
    });
  });

  describe("logToolResult", () => {
    it("logs successful result", () => {
      logToolResult({
        sessionKey: "test-session",
        tool: "web_fetch",
        toolCallId: "call-123",
        status: "success",
        durationMs: 150,
      });

      const logPath = getAuditLogPath();
      const content = fs.readFileSync(logPath, "utf-8");
      const entry = parseLastEntry(content);

      expect(entry.event).toBe("tool_result");
      expect(entry.status).toBe("success");
      expect(entry.durationMs).toBe(150);
    });

    it("logs error result", () => {
      logToolResult({
        sessionKey: "test-session",
        tool: "exec",
        toolCallId: "call-456",
        status: "error",
        error: "Command not found",
      });

      const logPath = getAuditLogPath();
      const content = fs.readFileSync(logPath, "utf-8");
      const entry = parseLastEntry(content);

      expect(entry.status).toBe("error");
      expect(entry.error).toBe("Command not found");
    });
  });

  describe("logToolError", () => {
    it("logs tool error event", () => {
      logToolError({
        sessionKey: "test-session",
        tool: "browser",
        toolCallId: "call-error",
        error: "Browser automation failed",
      });

      const logPath = getAuditLogPath();
      const content = fs.readFileSync(logPath, "utf-8");
      const entry = parseLastEntry(content);

      expect(entry.event).toBe("tool_error");
      expect(entry.status).toBe("error");
      expect(entry.error).toBe("Browser automation failed");
    });

    it("truncates long error messages", () => {
      const longError = "x".repeat(1000);
      logToolError({
        sessionKey: "test-session",
        tool: "exec",
        toolCallId: "call-long-error",
        error: longError,
      });

      const logPath = getAuditLogPath();
      const content = fs.readFileSync(logPath, "utf-8");
      const entry = parseLastEntry(content);

      expect(entry.error.length).toBeLessThanOrEqual(500);
      expect(entry.error).toContain("...");
    });
  });
});
