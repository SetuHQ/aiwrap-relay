import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hindsightConfig } from "../../src/lib/hindsight.js";

const hindsightSource = readFileSync(join(process.cwd(), "src/lib/hindsight.ts"), "utf8");

describe("secret handling", () => {
  it("ships no hardcoded credentials", () => {
    expect(hindsightSource).not.toMatch(/hs_pat/);
    expect(hindsightSource).not.toMatch(/sk-[A-Za-z0-9]/);
    // The only Bearer occurrence should be the header built from config.
    const bearers = hindsightSource.match(/Bearer [^$"\\]/g) ?? [];
    expect(bearers).toEqual([]);
  });

  it("writes client config files with owner-only permissions", () => {
    // The tenant token lands in ~/.codex/config.toml, so the mode matters.
    expect(hindsightSource).toContain("mode: 0o600");
  });

  it("lets the environment override the token without editing files", async () => {
    const previous = process.env.HINDSIGHT_TOKEN;
    process.env.HINDSIGHT_TOKEN = "env-provided-token";
    try {
      const config = await hindsightConfig();
      expect(config.token).toBe("env-provided-token");
    } finally {
      if (previous === undefined) delete process.env.HINDSIGHT_TOKEN;
      else process.env.HINDSIGHT_TOKEN = previous;
    }
  });

  it("targets the loopback interface by default", async () => {
    const previous = process.env.HINDSIGHT_URL;
    delete process.env.HINDSIGHT_URL;
    try {
      const config = await hindsightConfig();
      expect(config.url).toBe("http://127.0.0.1:8888");
      expect(config.mcpUrl).toMatch(/^http:\/\/127\.0\.0\.1:8888\/mcp\/.+\/$/);
    } finally {
      if (previous !== undefined) process.env.HINDSIGHT_URL = previous;
    }
  });
});
