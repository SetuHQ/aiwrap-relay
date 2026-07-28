import { readFile, writeFile } from "node:fs/promises";
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

  const existing = await listClaudeMcp();
  if (existing.ok && new RegExp(`^${HINDSIGHT_SERVER_NAME}:`, "m").test(existing.stdout)) {
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
  return runSafe("claude", args);
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
 * Match a TOML table: the header line plus every following line that does not
 * itself open a new table. Line-anchored, so a value containing a bracket
 * (args = ["a"]) does not truncate the match.
 */
function tablePattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  return new RegExp(`^\\[${escaped}\\][^\\n]*\\n(?:(?!\\[)[^\\n]*\\n?)*`, "m");
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

  await writeFile(CODEX_CONFIG, text, { mode: 0o600 });
  return { ok: true as const, stdout: "updated", stderr: "" };
}

async function removeStaleCodexEntry(): Promise<boolean> {
  const original = await readIfExists(CODEX_CONFIG);
  if (original === "") return false;
  const text = normaliseToml(
    original.replace(tablePattern(`mcp_servers.${STALE_SERVER_NAME}`), ""),
  );
  if (text === original) return false;
  await writeFile(CODEX_CONFIG, text, { mode: 0o600 });
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
