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

  it("launch command reads token from Keychain and never hardcodes a PAT", () => {
    const source = readFileSync(join(process.cwd(), "src/commands/launch-hindsight-mcp.ts"), "utf8");
    expect(source).toContain("getHindsightToken");
    expect(source).toContain("HINDSIGHT_API_TOKEN");
    expect(source).not.toContain("hs_pat");
  });
});
