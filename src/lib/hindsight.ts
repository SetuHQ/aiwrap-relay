import { chmod, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CODEX_CONFIG } from "./paths.js";
import { exists } from "./files.js";
import { runSafe } from "./shell.js";

/**
 * Hindsight here means Vectorize Hindsight (https://hindsight.vectorize.io),
 * self-hosted over HTTP.
 *
 * It is NOT `hindsight-mcp` on npm — that is a different product
 * (github.com/hindsight-ai/hindsight-ai) that aiwrap used to vendor and
 * register as a stdio server. Older installs still carry that dead entry;
 * `removeStaleHindsightMcp` clears it.
 */

export const HINDSIGHT_SERVER_NAME = "hindsight";
const STALE_SERVER_NAME = "hindsight-mcp";
const DEFAULT_URL = "http://127.0.0.1:8888";
const DEFAULT_BANK = "pulkit";

/** Where the self-hosted service keeps its configuration. */
const HINDSIGHT_ENV = join(homedir(), "hindsight", ".env");

export type HindsightConfig = {
  /** Base URL of the API server, no trailing slash. */
  url: string;
  /** Bank the MCP endpoint is pinned to. */
  bank: string;
  /** Tenant API key, empty when the server runs unauthenticated. */
  token: string;
  /** Full single-bank MCP endpoint. */
  mcpUrl: string;
};

/**
 * Resolve the Hindsight connection. Environment variables win so a different
 * instance can be targeted without editing files; otherwise the values come
 * from ~/hindsight/.env, which is the single source of truth for the service.
 */
export async function hindsightConfig(): Promise<HindsightConfig> {
  const fromEnv = await readEnvFile(HINDSIGHT_ENV);
  const url = (process.env.HINDSIGHT_URL || DEFAULT_URL).replace(/\/+$/, "");
  const bank = process.env.HINDSIGHT_BANK || DEFAULT_BANK;
  const token = process.env.HINDSIGHT_TOKEN || fromEnv.HINDSIGHT_API_TENANT_API_KEY || "";
  return { url, bank, token, mcpUrl: `${url}/mcp/${bank}/` };
}

/** True when the API answers. A 401 still counts — the service is up. */
export async function hindsightReachable(config?: HindsightConfig): Promise<boolean> {
  const { url } = config ?? (await hindsightConfig());
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return response.status === 200 || response.status === 401;
  } catch {
    return false;
  }
}

/** True when ~/hindsight exists, i.e. the service is set up on this machine. */
export async function hindsightInstalled(): Promise<boolean> {
  return exists(HINDSIGHT_ENV);
}

export async function registerClaudeHindsight(dryRun = false) {
  if (dryRun) return { ok: true as const, stderr: "" };
  const config = await hindsightConfig();
  await removeStaleClaudeEntry();

  // Compare against what is actually stored, not merely whether a `hindsight`
  // entry exists. Skipping on presence alone left a rotated token in place,
  // which then 401s on every call — the registration looks healthy in
  // `claude mcp list` while being unusable.
  if (await claudeEntryUpToDate(config)) {
    return { ok: true as const, stderr: "" };
  }

  const args = [
    "mcp",
    "add",
    "--scope",
    "user",
    "--transport",
    "http",
    HINDSIGHT_SERVER_NAME,
    config.mcpUrl,
  ];
  if (config.token) args.push("--header", `Authorization: Bearer ${config.token}`);

  // `claude mcp add` refuses to overwrite, so an out-of-date entry must be
  // removed first. That opens a window where a failed add leaves no
  // registration at all, so surface it explicitly rather than silently.
  const hadEntry = await claudeEntryExists();
  if (hadEntry) {
    await runSafe("claude", ["mcp", "remove", "--scope", "user", HINDSIGHT_SERVER_NAME]);
  }
  const result = await runSafe("claude", args);
  if (!result.ok && hadEntry) {
    return {
      ok: false as const,
      stdout: result.stdout,
      stderr: `${result.stderr}\nThe previous '${HINDSIGHT_SERVER_NAME}' entry was removed and could not be replaced. Re-run: aiwrap repair mcp`,
    };
  }
  return result;
}

/** Read the stored Claude Code MCP entry for Hindsight, if any. */
async function claudeStoredEntry(): Promise<{ url?: string; headers?: Record<string, string> } | null> {
  const text = await readIfExists(join(homedir(), ".claude.json"));
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { mcpServers?: Record<string, { url?: string; headers?: Record<string, string> }> };
    return parsed.mcpServers?.[HINDSIGHT_SERVER_NAME] ?? null;
  } catch {
    return null;
  }
}

async function claudeEntryExists(): Promise<boolean> {
  if (await claudeStoredEntry()) return true;
  const list = await listClaudeMcp();
  return list.ok && new RegExp(`^${HINDSIGHT_SERVER_NAME}:`, "m").test(list.stdout);
}

/** True when the stored entry already points at this url with this token. */
async function claudeEntryUpToDate(config: HindsightConfig): Promise<boolean> {
  const entry = await claudeStoredEntry();
  if (!entry || entry.url !== config.mcpUrl) return false;
  const stored = entry.headers?.Authorization ?? "";
  const wanted = config.token ? `Bearer ${config.token}` : "";
  return stored === wanted;
}

export async function registerCodexHindsight(dryRun = false) {
  if (dryRun) return { ok: true as const, stderr: "" };
  const config = await hindsightConfig();

  // Direct file surgery rather than `codex mcp add`, because the Codex
  // desktop app ships no CLI on PATH and a static header is required anyway:
  // a macOS GUI app does not inherit the shell environment, so
  // bearer_token_env_var would never resolve.
  return writeCodexEntry(config);
}

/**
 * Remove the dead `hindsight-mcp` stdio registration from both clients.
 * Safe to call when it was never there.
 */
export async function removeStaleHindsightMcp(): Promise<string[]> {
  const removed: string[] = [];
  if (await removeStaleClaudeEntry()) removed.push("claude");
  if (await removeStaleCodexEntry()) removed.push("codex");
  return removed;
}

export async function listClaudeMcp() {
  return runSafe("claude", ["mcp", "list"]);
}

export async function listCodexMcp() {
  const text = await readIfExists(CODEX_CONFIG);
  const servers = [...text.matchAll(/^\[mcp_servers\.([^\]]+)\]/gm)].map((m) => m[1]);
  return { ok: text !== "", stdout: servers.join("\n"), stderr: "" };
}

// --------------------------------------------------------------------------
// Codex config.toml surgery
// --------------------------------------------------------------------------

/**
 * Match a TOML table AND its dotted subtables: the header line plus every
 * following line that does not open an unrelated table.
 *
 * Including subtables is load-bearing. TOML creates a parent implicitly from a
 * dotted child, so leaving `[mcp_servers.hindsight-mcp.env]` behind after
 * removing `[mcp_servers.hindsight-mcp]` resurrects the entry as a malformed
 * server with no command and no url — reviving exactly what the removal exists
 * to delete. Codex does use this shape (`[mcp_servers.node_repl.env]`).
 *
 * Line-anchored rather than "any char except [", so a value containing a
 * bracket (args = ["a"]) does not truncate the match.
 */
function tablePattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  // [name] or [name.child] / [name.child.grandchild]
  const header = `\\[${escaped}(?:\\.[^\\]\\n]+)?\\]`;
  const body = `[^\\n]*\\n(?:(?!\\[)[^\\n]*\\n?)*`;
  // Trailing repeat so a run of adjacent subtables is consumed as one block.
  return new RegExp(`^${header}${body}(?:^${header}${body})*`, "m");
}

function normaliseToml(text: string): string {
  return `${text.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "")}\n`;
}

async function writeCodexEntry(config: HindsightConfig) {
  const original = await readIfExists(CODEX_CONFIG);
  if (original === "") {
    return { ok: false as const, stdout: "", stderr: `${CODEX_CONFIG} not found` };
  }

  let text = original.replace(tablePattern(`mcp_servers.${STALE_SERVER_NAME}`), "");

  const header = config.token
    ? `http_headers = { Authorization = "Bearer ${config.token}" }\n`
    : "";
  const block = `[mcp_servers.${HINDSIGHT_SERVER_NAME}]\nurl = "${config.mcpUrl}"\n${header}`;
  const pattern = tablePattern(`mcp_servers.${HINDSIGHT_SERVER_NAME}`);

  text = pattern.test(text)
    ? text.replace(pattern, `${block}\n`)
    : `${text.replace(/\n+$/, "")}\n\n${block}`;

  text = normaliseToml(text);
  if (text === original) return { ok: true as const, stdout: "unchanged", stderr: "" };

  await writeSecret(CODEX_CONFIG, text);
  return { ok: true as const, stdout: "updated", stderr: "" };
}

/**
 * Write a file that holds a credential, owner-read/write only.
 *
 * The explicit chmod is required: `writeFile`'s `mode` option is only honoured
 * when the file is *created*, so writing over an existing 0644 config would
 * silently leave the tenant token group- and world-readable.
 */
async function writeSecret(path: string, text: string): Promise<void> {
  await writeFile(path, text, { mode: 0o600 });
  await chmod(path, 0o600);
}

async function removeStaleCodexEntry(): Promise<boolean> {
  const original = await readIfExists(CODEX_CONFIG);
  if (original === "") return false;
  const text = normaliseToml(
    original.replace(tablePattern(`mcp_servers.${STALE_SERVER_NAME}`), ""),
  );
  if (text === original) return false;
  await writeSecret(CODEX_CONFIG, text);
  return true;
}

async function removeStaleClaudeEntry(): Promise<boolean> {
  const list = await listClaudeMcp();
  if (!list.ok || !new RegExp(`^${STALE_SERVER_NAME}:`, "m").test(list.stdout)) return false;
  const result = await runSafe("claude", ["mcp", "remove", "--scope", "user", STALE_SERVER_NAME]);
  return result.ok;
}

// --------------------------------------------------------------------------

async function readIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

/**
 * Minimal KEY=VALUE reader. Values are taken verbatim after the first `=`,
 * which matters because the Hindsight instructions value contains backticks
 * and punctuation that a shell-style parser would mangle.
 */
async function readEnvFile(path: string): Promise<Record<string, string>> {
  const text = await readIfExists(path);
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return out;
}
