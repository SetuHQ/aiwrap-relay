import { describe, expect, it } from "vitest";
import { claudexTemplate, codexxTemplate, hindsightLauncherTemplate } from "../../src/lib/templates.js";

describe("launcher templates", () => {
  it("codexx delegates to codex without replacing it", () => {
    const script = codexxTemplate();
    expect(script).toContain("command -v codex");
    expect(script).toContain("exec codex \"$@\"");
  });

  it("claudex delegates to claude without replacing it", () => {
    const script = claudexTemplate();
    expect(script).toContain("command -v claude");
    expect(script).toContain("exec claude \"$@\"");
  });

  it("hindsight launcher delegates to aiwrap", () => {
    const script = hindsightLauncherTemplate();
    expect(script).toContain("launch-hindsight-mcp");
    expect(script).not.toContain("python3");
  });
});
