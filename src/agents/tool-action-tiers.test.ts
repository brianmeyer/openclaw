import { describe, it, expect } from "vitest";

import {
  getToolTier,
  detectDestructiveCommand,
  getToolsInTier,
  TIER_TOOL_GROUPS,
} from "./tool-action-tiers.js";

describe("tool-action-tiers", () => {
  describe("getToolTier", () => {
    it("classifies read tools correctly", () => {
      const readTools = ["read", "web_search", "web_fetch", "memory_search", "session_status"];
      for (const tool of readTools) {
        const result = getToolTier(tool);
        expect(result.tier).toBe("read");
      }
    });

    it("classifies write tools correctly", () => {
      const writeTools = ["write", "edit", "message", "cron", "browser"];
      for (const tool of writeTools) {
        const result = getToolTier(tool);
        expect(result.tier).toBe("write");
      }
    });

    it("classifies destructive tools correctly", () => {
      const destructiveTools = ["exec", "process", "elevated_exec"];
      for (const tool of destructiveTools) {
        const result = getToolTier(tool);
        expect(result.tier).toBe("destructive");
      }
    });

    it("defaults unknown tools to write tier", () => {
      const result = getToolTier("unknown_tool_xyz");
      expect(result.tier).toBe("write");
      expect(result.reason).toContain("Unknown tool");
    });

    it("normalizes tool names to lowercase", () => {
      const result = getToolTier("READ");
      expect(result.tier).toBe("read");
      expect(result.tool).toBe("read");
    });
  });

  describe("detectDestructiveCommand", () => {
    describe("file deletion patterns", () => {
      it("detects rm -rf", () => {
        const result = detectDestructiveCommand("rm -rf /tmp/test");
        expect(result.isDestructive).toBe(true);
        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].severity).toBe("critical");
      });

      it("detects rm -r", () => {
        const result = detectDestructiveCommand("rm -r ./build");
        expect(result.isDestructive).toBe(true);
      });

      it("detects rm --no-preserve-root", () => {
        const result = detectDestructiveCommand("rm --no-preserve-root /");
        expect(result.isDestructive).toBe(true);
        expect(result.matches[0].severity).toBe("critical");
      });
    });

    describe("database patterns", () => {
      it("detects DROP TABLE", () => {
        const result = detectDestructiveCommand("DROP TABLE users;");
        expect(result.isDestructive).toBe(true);
        expect(result.matches[0].description).toContain("DROP");
      });

      it("detects DROP DATABASE", () => {
        const result = detectDestructiveCommand("DROP DATABASE production;");
        expect(result.isDestructive).toBe(true);
      });

      it("detects TRUNCATE TABLE", () => {
        const result = detectDestructiveCommand("TRUNCATE TABLE logs;");
        expect(result.isDestructive).toBe(true);
      });
    });

    describe("git patterns", () => {
      it("detects git push --force", () => {
        const result = detectDestructiveCommand("git push --force origin main");
        expect(result.isDestructive).toBe(true);
        expect(result.matches[0].description).toContain("Force push");
      });

      it("detects git push -f", () => {
        const result = detectDestructiveCommand("git push -f origin main");
        expect(result.isDestructive).toBe(true);
      });

      it("detects git reset --hard", () => {
        const result = detectDestructiveCommand("git reset --hard HEAD~1");
        expect(result.isDestructive).toBe(true);
      });

      it("detects git clean -fd", () => {
        const result = detectDestructiveCommand("git clean -fd");
        expect(result.isDestructive).toBe(true);
      });
    });

    describe("system patterns", () => {
      it("detects dd commands", () => {
        const result = detectDestructiveCommand("dd if=/dev/zero of=/dev/sda");
        expect(result.isDestructive).toBe(true);
        expect(result.matches[0].severity).toBe("critical");
      });

      it("detects sudo rm", () => {
        const result = detectDestructiveCommand("sudo rm -rf /var/log");
        expect(result.isDestructive).toBe(true);
        // Should match both sudo rm and rm -rf
        expect(result.matches.length).toBeGreaterThanOrEqual(1);
      });

      it("detects chmod 777", () => {
        const result = detectDestructiveCommand("chmod 777 /etc/passwd");
        expect(result.isDestructive).toBe(true);
      });
    });

    describe("safe commands", () => {
      it("allows regular ls", () => {
        const result = detectDestructiveCommand("ls -la");
        expect(result.isDestructive).toBe(false);
        expect(result.matches).toHaveLength(0);
      });

      it("allows regular git commands", () => {
        const result = detectDestructiveCommand("git status");
        expect(result.isDestructive).toBe(false);
      });

      it("allows git push without force", () => {
        const result = detectDestructiveCommand("git push origin main");
        expect(result.isDestructive).toBe(false);
      });

      it("allows cat commands", () => {
        const result = detectDestructiveCommand("cat package.json");
        expect(result.isDestructive).toBe(false);
      });

      it("allows npm install", () => {
        const result = detectDestructiveCommand("npm install express");
        expect(result.isDestructive).toBe(false);
      });
    });

    describe("case insensitivity", () => {
      it("detects DROP TABLE in lowercase", () => {
        const result = detectDestructiveCommand("drop table users");
        expect(result.isDestructive).toBe(true);
      });

      it("detects mixed case", () => {
        const result = detectDestructiveCommand("Drop Database test");
        expect(result.isDestructive).toBe(true);
      });
    });
  });

  describe("getToolsInTier", () => {
    it("returns read tier tools", () => {
      const tools = getToolsInTier("read");
      expect(tools).toContain("read");
      expect(tools).toContain("web_search");
      expect(tools).not.toContain("exec");
    });

    it("returns write tier tools", () => {
      const tools = getToolsInTier("write");
      expect(tools).toContain("write");
      expect(tools).toContain("edit");
      expect(tools).not.toContain("exec");
    });

    it("returns destructive tier tools", () => {
      const tools = getToolsInTier("destructive");
      expect(tools).toContain("exec");
      expect(tools).toContain("process");
      expect(tools).not.toContain("read");
    });
  });

  describe("TIER_TOOL_GROUPS", () => {
    it("defines group:read", () => {
      expect(TIER_TOOL_GROUPS["group:read"]).toBeDefined();
      expect(TIER_TOOL_GROUPS["group:read"]).toContain("read");
    });

    it("defines group:write", () => {
      expect(TIER_TOOL_GROUPS["group:write"]).toBeDefined();
      expect(TIER_TOOL_GROUPS["group:write"]).toContain("write");
    });

    it("defines group:destructive", () => {
      expect(TIER_TOOL_GROUPS["group:destructive"]).toBeDefined();
      expect(TIER_TOOL_GROUPS["group:destructive"]).toContain("exec");
    });
  });
});
