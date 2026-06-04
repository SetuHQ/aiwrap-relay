import { describe, expect, it } from "vitest";
import { hindsightLauncherTemplate } from "../../src/lib/templates.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("secret handling", () => {
  it("launcher delegates secret handling to aiwrap", () => {
    const script = hindsightLauncherTemplate();
    expect(script).toContain("launch-hindsight-mcp");
    expect(script).not.toContain("HINDSIGHT_API_TOKEN=hs_pat");
  });

  it("launch command does not inject Cloud/API tokens", () => {
    const source = readFileSync(join(process.cwd(), "src/commands/launch-hindsight-mcp.ts"), "utf8");
    expect(source).not.toContain("getHindsightToken");
    expect(source).not.toContain("HINDSIGHT_API_TOKEN");
    expect(source).not.toContain("hs_pat");
  });
});
