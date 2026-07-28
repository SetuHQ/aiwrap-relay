import { describe, expect, it } from "vitest";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * These exercise the two defects found reviewing the HTTP migration:
 *
 *  1. Removing `[mcp_servers.hindsight-mcp]` left `[…hindsight-mcp.env]`
 *     behind. TOML creates the parent implicitly from a dotted child, so the
 *     entry came back as a malformed server with no command and no url.
 *  2. `writeFile(path, data, {mode})` only applies `mode` when *creating* a
 *     file, so rewriting an existing 0644 config left the token readable.
 *
 * tablePattern/writeSecret are module-private, so the behaviour is reproduced
 * here against the same inputs rather than imported.
 */

function tablePattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  const header = `\\[${escaped}(?:\\.[^\\]\\n]+)?\\]`;
  const body = `[^\\n]*\\n(?:(?!\\[)[^\\n]*\\n?)*`;
  return new RegExp(`^${header}${body}(?:^${header}${body})*`, "m");
}

const remove = (text: string, name: string) => text.replace(tablePattern(name), "");

/** Server names TOML would expose, including ones implied by dotted children. */
function serversIn(toml: string): string[] {
  const names = new Set<string>();
  for (const m of toml.matchAll(/^\[mcp_servers\.([^\]\n]+)\]/gm)) {
    names.add(m[1].split(".")[0]);
  }
  return [...names];
}

describe("codex config.toml table removal", () => {
  it("takes dotted subtables with the parent, so the entry cannot revive", () => {
    const toml = [
      "[mcp_servers.hindsight-mcp]",
      'command = "/dead/launcher"',
      "",
      "[mcp_servers.hindsight-mcp.env]",
      'SECRET_TOKEN = "leftover"',
      "",
      "[mcp_servers.other]",
      'url = "keep"',
      "",
    ].join("\n");

    const out = remove(toml, "mcp_servers.hindsight-mcp");

    expect(out).not.toContain("hindsight-mcp");
    expect(out).not.toContain("SECRET_TOKEN");
    // The implicit-parent trap: no residual name may imply the server.
    expect(serversIn(out)).toEqual(["other"]);
    expect(out).toContain('url = "keep"');
  });

  it("consumes a run of adjacent subtables", () => {
    const toml = [
      "[mcp_servers.hindsight-mcp]",
      'command = "x"',
      "[mcp_servers.hindsight-mcp.env]",
      'A = "1"',
      "[mcp_servers.hindsight-mcp.env.nested]",
      'B = "2"',
      "[mcp_servers.keep]",
      'url = "y"',
      "",
    ].join("\n");

    expect(serversIn(remove(toml, "mcp_servers.hindsight-mcp"))).toEqual(["keep"]);
  });

  it("does not touch a differently-named server sharing a prefix", () => {
    const toml = [
      "[mcp_servers.hindsight]",
      'url = "http://keep/"',
      "",
      "[mcp_servers.hindsight-mcp]",
      'command = "remove me"',
      "",
    ].join("\n");

    const out = remove(toml, "mcp_servers.hindsight-mcp");
    expect(out).toContain('url = "http://keep/"');
    expect(serversIn(out)).toEqual(["hindsight"]);
  });

  it("leaves a value containing a bracket intact", () => {
    const toml = [
      "[mcp_servers.playwright]",
      'args = ["@playwright/mcp@latest"]',
      "",
      "[mcp_servers.hindsight-mcp]",
      'command = "x"',
      "",
    ].join("\n");

    const out = remove(toml, "mcp_servers.hindsight-mcp");
    expect(out).toContain('args = ["@playwright/mcp@latest"]');
    expect(serversIn(out)).toEqual(["playwright"]);
  });
});

describe("credential file permissions", () => {
  it("tightens mode on an existing loose file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aiwrap-mode-"));
    const path = join(dir, "config.toml");
    try {
      await writeFile(path, "existing\n");
      await chmod(path, 0o644);

      // writeSecret(): the explicit chmod is what makes this hold.
      await writeFile(path, 'http_headers = { Authorization = "Bearer T" }\n', { mode: 0o600 });
      await chmod(path, 0o600);

      expect((await stat(path)).mode & 0o777).toBe(0o600);
      expect(await readFile(path, "utf8")).toContain("Bearer T");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("documents why the mode option alone is insufficient", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aiwrap-mode-"));
    const path = join(dir, "config.toml");
    try {
      await writeFile(path, "existing\n");
      await chmod(path, 0o644);
      // No chmod: Node ignores `mode` because the file already exists.
      await writeFile(path, "secret\n", { mode: 0o600 });
      expect((await stat(path)).mode & 0o777).toBe(0o644);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
