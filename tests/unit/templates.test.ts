import { describe, expect, it } from "vitest";
import { hindsightLauncherTemplate } from "../../src/lib/templates.js";

describe("launcher templates", () => {
  it("hindsight launcher delegates to aiwrap", () => {
    const script = hindsightLauncherTemplate();
    expect(script).toContain("launch-hindsight-mcp");
    expect(script).not.toContain("python3");
  });
});
