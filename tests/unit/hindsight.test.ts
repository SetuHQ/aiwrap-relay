import { describe, expect, it } from "vitest";
import { HINDSIGHT_SERVER_NAME, hindsightConfig } from "../../src/lib/hindsight.js";

describe("hindsight config", () => {
  it("registers under a name distinct from the obsolete hindsight-mcp", () => {
    // Two unrelated products share the Hindsight name. Registering both under
    // similar names is what confuses the model, so keep them distinguishable.
    expect(HINDSIGHT_SERVER_NAME).toBe("hindsight");
    expect(HINDSIGHT_SERVER_NAME).not.toBe("hindsight-mcp");
  });

  it("builds a single-bank MCP URL with a trailing slash", async () => {
    const previousUrl = process.env.HINDSIGHT_URL;
    const previousBank = process.env.HINDSIGHT_BANK;
    process.env.HINDSIGHT_URL = "http://example.test:9000/";
    process.env.HINDSIGHT_BANK = "somebank";
    try {
      const config = await hindsightConfig();
      // Trailing slashes on the base URL must not double up.
      expect(config.url).toBe("http://example.test:9000");
      expect(config.mcpUrl).toBe("http://example.test:9000/mcp/somebank/");
    } finally {
      restore("HINDSIGHT_URL", previousUrl);
      restore("HINDSIGHT_BANK", previousBank);
    }
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
