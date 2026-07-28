import { describe, expect, it } from "vitest";
import { AIWRAP_HOME, LOCAL_BIN, managedPaths, obsoletePaths } from "../../src/lib/paths.js";

describe("managed paths", () => {
  it("keeps managed binaries under the user home", () => {
    expect(AIWRAP_HOME).toContain(".ai-cli-wrapper");
    expect(LOCAL_BIN).toContain(".local/bin");
    expect(managedPaths.rtk).toContain(".ai-cli-wrapper/bin/rtk");
  });

  it("no longer manages a vendored hindsight-mcp binary", () => {
    expect(managedPaths).not.toHaveProperty("hindsightMcp");
    expect(managedPaths).not.toHaveProperty("hindsightLauncher");
  });

  it("still knows the obsolete paths so they can be cleaned up", () => {
    expect(obsoletePaths.hindsightMcp).toContain(".ai-cli-wrapper/bin/hindsight-mcp");
    expect(obsoletePaths.hindsightLauncher).toContain(".ai-cli-wrapper/bin/hindsight-mcp-launcher");
  });
});
