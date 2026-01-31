import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { analyzeAuditLog } from "./audit-log-analysis.js";
import type { ToolAuditEntry } from "./audit-log.js";

describe("audit-log-analysis", () => {
  let tempDir: string;
  let logPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-analysis-test-"));
    logPath = path.join(tempDir, "tool-audit.jsonl");
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function writeEntries(entries: ToolAuditEntry[]): void {
    const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.writeFileSync(logPath, content);
  }

  function makeEntry(overrides: Partial<ToolAuditEntry> = {}): ToolAuditEntry {
    return {
      timestamp: new Date().toISOString(),
      event: "tool_call",
      sessionKey: "test-session",
      tool: "web_fetch",
      toolCallId: `call-${Math.random().toString(36).slice(2)}`,
      ...overrides,
    };
  }

  describe("analyzeAuditLog", () => {
    it("returns empty analysis for non-existent log", async () => {
      const analysis = await analyzeAuditLog({
        logPath: path.join(tempDir, "does-not-exist.jsonl"),
      });

      expect(analysis.totalCalls).toBe(0);
      expect(analysis.totalErrors).toBe(0);
      expect(analysis.anomalies).toHaveLength(0);
    });

    it("counts tool calls and errors", async () => {
      writeEntries([
        makeEntry({ tool: "bash", event: "tool_call" }),
        makeEntry({ tool: "bash", event: "tool_result", status: "success" }),
        makeEntry({ tool: "read", event: "tool_call" }),
        makeEntry({ tool: "read", event: "tool_result", status: "error" }),
        makeEntry({ tool: "web_fetch", event: "tool_call" }),
        makeEntry({ tool: "web_fetch", event: "tool_error", status: "error" }),
      ]);

      const analysis = await analyzeAuditLog({ logPath });

      expect(analysis.totalCalls).toBe(3); // Only tool_call events
      expect(analysis.totalErrors).toBe(2); // error statuses + tool_error events
    });

    it("calculates error rate correctly", async () => {
      const entries: ToolAuditEntry[] = [];
      for (let i = 0; i < 8; i++) {
        entries.push(makeEntry({ tool: "read", event: "tool_call" }));
        entries.push(makeEntry({ tool: "read", event: "tool_result", status: "success" }));
      }
      for (let i = 0; i < 2; i++) {
        entries.push(makeEntry({ tool: "bash", event: "tool_call" }));
        entries.push(makeEntry({ tool: "bash", event: "tool_result", status: "error" }));
      }
      writeEntries(entries);

      const analysis = await analyzeAuditLog({ logPath });

      expect(analysis.totalCalls).toBe(10);
      expect(analysis.totalErrors).toBe(2);
      expect(analysis.errorRate).toBeCloseTo(0.2);
    });

    it("detects high error rate anomaly", async () => {
      const entries: ToolAuditEntry[] = [];
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({ tool: "exec", event: "tool_call" }));
        entries.push(makeEntry({ tool: "exec", event: "tool_result", status: "success" }));
      }
      for (let i = 0; i < 6; i++) {
        entries.push(makeEntry({ tool: "exec", event: "tool_call" }));
        entries.push(makeEntry({ tool: "exec", event: "tool_result", status: "error" }));
      }
      writeEntries(entries);

      const analysis = await analyzeAuditLog({ logPath });

      const highErrorAnomaly = analysis.anomalies.find(
        (a) => a.kind === "high_error_rate" && a.tool === "exec",
      );
      expect(highErrorAnomaly).toBeDefined();
      expect(highErrorAnomaly?.severity).toBe("warn");
    });

    it("detects sensitive tool burst", async () => {
      const now = Date.now();
      const entries: ToolAuditEntry[] = [];

      // Create 12 sensitive tool calls within 2 minutes
      for (let i = 0; i < 12; i++) {
        entries.push(
          makeEntry({
            tool: "bash",
            event: "tool_call",
            timestamp: new Date(now + i * 5000).toISOString(), // 5s apart
          }),
        );
      }
      writeEntries(entries);

      const analysis = await analyzeAuditLog({ logPath });

      const burstAnomaly = analysis.anomalies.find((a) => a.kind === "sensitive_burst");
      expect(burstAnomaly).toBeDefined();
      expect(burstAnomaly?.severity).toBe("critical");
    });

    it("detects denied attempts pattern", async () => {
      writeEntries([
        makeEntry({ tool: "exec", event: "tool_call", approvalGranted: false }),
        makeEntry({ tool: "exec", event: "tool_call", approvalGranted: false }),
        makeEntry({ tool: "exec", event: "tool_call", approvalGranted: false }),
      ]);

      const analysis = await analyzeAuditLog({ logPath });

      const deniedAnomaly = analysis.anomalies.find((a) => a.kind === "denied_attempt");
      expect(deniedAnomaly).toBeDefined();
      expect(deniedAnomaly?.severity).toBe("critical"); // exec is sensitive
    });

    it("tracks unique sessions", async () => {
      writeEntries([
        makeEntry({ sessionKey: "session-1", event: "tool_call" }),
        makeEntry({ sessionKey: "session-1", event: "tool_call" }),
        makeEntry({ sessionKey: "session-2", event: "tool_call" }),
        makeEntry({ sessionKey: "session-3", event: "tool_call" }),
      ]);

      const analysis = await analyzeAuditLog({ logPath });

      expect(analysis.uniqueSessions).toBe(3);
    });

    it("respects time window", async () => {
      const now = Date.now();
      writeEntries([
        makeEntry({
          event: "tool_call",
          timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        }),
        makeEntry({
          event: "tool_call",
          timestamp: new Date(now - 30 * 60 * 1000).toISOString(), // 30 min ago
        }),
      ]);

      const analysis = await analyzeAuditLog({
        logPath,
        windowMs: 60 * 60 * 1000, // 1 hour
      });

      expect(analysis.totalCalls).toBe(1); // Only the recent one
    });

    it("provides tool breakdown", async () => {
      writeEntries([
        makeEntry({ tool: "bash", event: "tool_call" }),
        makeEntry({ tool: "bash", event: "tool_call" }),
        makeEntry({ tool: "read", event: "tool_call" }),
        makeEntry({ tool: "read", event: "tool_result", status: "error" }),
      ]);

      const analysis = await analyzeAuditLog({ logPath });

      expect(analysis.toolBreakdown.bash).toBeDefined();
      expect(analysis.toolBreakdown.bash.calls).toBe(2);
      expect(analysis.toolBreakdown.read).toBeDefined();
      expect(analysis.toolBreakdown.read.calls).toBe(1);
      expect(analysis.toolBreakdown.read.errors).toBe(1);
    });
  });
});
