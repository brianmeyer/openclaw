import { describe, it, expect } from "vitest";

import { TOOL_GROUPS, expandToolGroups, resolveToolProfilePolicy } from "./tool-policy.js";

describe("tool-policy tiered permissions", () => {
  describe("TOOL_GROUPS tier groups", () => {
    it("defines group:read", () => {
      expect(TOOL_GROUPS["group:read"]).toBeDefined();
      expect(TOOL_GROUPS["group:read"]).toBeInstanceOf(Array);
    });

    it("group:read contains read-only tools", () => {
      const readGroup = TOOL_GROUPS["group:read"];
      expect(readGroup).toContain("read");
      expect(readGroup).toContain("web_search");
      expect(readGroup).toContain("web_fetch");
      expect(readGroup).toContain("memory_search");
      expect(readGroup).toContain("session_status");
      expect(readGroup).toContain("security_audit");
      expect(readGroup).toContain("security_monitor");
    });

    it("group:read does not contain write or destructive tools", () => {
      const readGroup = TOOL_GROUPS["group:read"];
      expect(readGroup).not.toContain("write");
      expect(readGroup).not.toContain("edit");
      expect(readGroup).not.toContain("exec");
      expect(readGroup).not.toContain("process");
    });

    it("defines group:write", () => {
      expect(TOOL_GROUPS["group:write"]).toBeDefined();
      expect(TOOL_GROUPS["group:write"]).toBeInstanceOf(Array);
    });

    it("group:write contains state-modifying tools", () => {
      const writeGroup = TOOL_GROUPS["group:write"];
      expect(writeGroup).toContain("write");
      expect(writeGroup).toContain("edit");
      expect(writeGroup).toContain("message");
      expect(writeGroup).toContain("cron");
      expect(writeGroup).toContain("security_fix");
    });

    it("group:write does not contain destructive tools", () => {
      const writeGroup = TOOL_GROUPS["group:write"];
      expect(writeGroup).not.toContain("exec");
      expect(writeGroup).not.toContain("process");
    });

    it("defines group:destructive", () => {
      expect(TOOL_GROUPS["group:destructive"]).toBeDefined();
      expect(TOOL_GROUPS["group:destructive"]).toBeInstanceOf(Array);
    });

    it("group:destructive contains high-risk tools", () => {
      const destructiveGroup = TOOL_GROUPS["group:destructive"];
      expect(destructiveGroup).toContain("exec");
      expect(destructiveGroup).toContain("process");
      expect(destructiveGroup).toContain("elevated_exec");
    });

    it("defines group:security", () => {
      expect(TOOL_GROUPS["group:security"]).toBeDefined();
      const securityGroup = TOOL_GROUPS["group:security"];
      expect(securityGroup).toContain("security_audit");
      expect(securityGroup).toContain("security_fix");
      expect(securityGroup).toContain("security_monitor");
      expect(securityGroup).toContain("security_scan_skills");
    });
  });

  describe("expandToolGroups with tier groups", () => {
    it("expands group:read to individual tools", () => {
      const expanded = expandToolGroups(["group:read"]);
      expect(expanded).toContain("read");
      expect(expanded).toContain("web_search");
      expect(expanded).toContain("memory_search");
    });

    it("expands group:write to individual tools", () => {
      const expanded = expandToolGroups(["group:write"]);
      expect(expanded).toContain("write");
      expect(expanded).toContain("edit");
      expect(expanded).toContain("message");
    });

    it("expands group:destructive to individual tools", () => {
      const expanded = expandToolGroups(["group:destructive"]);
      expect(expanded).toContain("exec");
      expect(expanded).toContain("process");
    });

    it("handles mixed groups and individual tools", () => {
      const expanded = expandToolGroups(["group:read", "write", "group:security"]);
      expect(expanded).toContain("read");
      expect(expanded).toContain("write");
      expect(expanded).toContain("security_audit");
    });
  });

  describe("resolveToolProfilePolicy with tiered profiles", () => {
    describe("safe profile", () => {
      it("resolves safe profile", () => {
        const policy = resolveToolProfilePolicy("safe");
        expect(policy).toBeDefined();
      });

      it("safe profile allows read and security groups", () => {
        const policy = resolveToolProfilePolicy("safe");
        expect(policy?.allow).toContain("group:read");
        expect(policy?.allow).toContain("group:security");
      });

      it("safe profile denies destructive group", () => {
        const policy = resolveToolProfilePolicy("safe");
        expect(policy?.deny).toContain("group:destructive");
      });

      it("safe profile does not include write group in allow", () => {
        const policy = resolveToolProfilePolicy("safe");
        expect(policy?.allow).not.toContain("group:write");
      });
    });

    describe("standard profile", () => {
      it("resolves standard profile", () => {
        const policy = resolveToolProfilePolicy("standard");
        expect(policy).toBeDefined();
      });

      it("standard profile allows read, write, and security groups", () => {
        const policy = resolveToolProfilePolicy("standard");
        expect(policy?.allow).toContain("group:read");
        expect(policy?.allow).toContain("group:write");
        expect(policy?.allow).toContain("group:security");
      });

      it("standard profile denies destructive group", () => {
        const policy = resolveToolProfilePolicy("standard");
        expect(policy?.deny).toContain("group:destructive");
      });
    });

    describe("profile comparison", () => {
      it("safe is more restrictive than standard", () => {
        const safePolicy = resolveToolProfilePolicy("safe");
        const standardPolicy = resolveToolProfilePolicy("standard");

        // Standard allows write, safe does not
        expect(standardPolicy?.allow).toContain("group:write");
        expect(safePolicy?.allow).not.toContain("group:write");
      });

      it("both safe and standard deny destructive", () => {
        const safePolicy = resolveToolProfilePolicy("safe");
        const standardPolicy = resolveToolProfilePolicy("standard");

        expect(safePolicy?.deny).toContain("group:destructive");
        expect(standardPolicy?.deny).toContain("group:destructive");
      });
    });
  });

  describe("tier group coverage", () => {
    it("tier groups do not overlap", () => {
      const readTools = new Set(TOOL_GROUPS["group:read"]);
      const writeTools = new Set(TOOL_GROUPS["group:write"]);
      const destructiveTools = new Set(TOOL_GROUPS["group:destructive"]);

      // Check no overlap between read and write
      for (const tool of readTools) {
        expect(writeTools.has(tool)).toBe(false);
      }

      // Check no overlap between read and destructive
      for (const tool of readTools) {
        expect(destructiveTools.has(tool)).toBe(false);
      }

      // Check no overlap between write and destructive
      for (const tool of writeTools) {
        expect(destructiveTools.has(tool)).toBe(false);
      }
    });

    it("security tools are classified in appropriate tiers", () => {
      const readTools = new Set(TOOL_GROUPS["group:read"]);
      const writeTools = new Set(TOOL_GROUPS["group:write"]);

      // security_audit, security_monitor, security_scan_skills are read-only
      expect(readTools.has("security_audit")).toBe(true);
      expect(readTools.has("security_monitor")).toBe(true);
      expect(readTools.has("security_scan_skills")).toBe(true);

      // security_fix modifies state, so it's in write tier
      expect(writeTools.has("security_fix")).toBe(true);
    });
  });
});
