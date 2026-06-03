import { describe, expect, it } from "vitest";
import { AIWRAP_HOME, LOCAL_BIN, managedPaths } from "../../src/lib/paths.js";

describe("managed paths", () => {
  it("keeps managed binaries under the user home", () => {
    expect(AIWRAP_HOME).toContain(".ai-cli-wrapper");
    expect(LOCAL_BIN).toContain(".local/bin");
    expect(managedPaths.rtk).toContain(".ai-cli-wrapper/bin/rtk");
    expect(managedPaths.hindsightLauncher).toContain(".ai-cli-wrapper/bin/hindsight-mcp-launcher");
  });
});
