import { managedPaths } from "./paths.js";
import { exists } from "./files.js";
import { runSafe } from "./shell.js";

export async function ensureManagedHindsightMcp(): Promise<boolean> {
  return exists(managedPaths.hindsightMcp);
}

export async function registerClaudeHindsight(dryRun = false) {
  if (dryRun) return { ok: true, stderr: "" };
  const existing = await listClaudeMcp();
  if (existing.ok && existing.stdout.includes("hindsight-mcp")) return { ok: true, stderr: "" };
  return runSafe("claude", [
    "mcp",
    "add",
    "--scope",
    "user",
    "--transport",
    "stdio",
    "hindsight-mcp",
    "--",
    managedPaths.hindsightLauncher,
  ]);
}

export async function registerCodexHindsight(dryRun = false) {
  if (dryRun) return { ok: true, stderr: "" };
  const existing = await listCodexMcp();
  if (existing.ok && existing.stdout.includes("hindsight-mcp")) return { ok: true, stderr: "" };
  return runSafe("codex", ["mcp", "add", "hindsight-mcp", "--", managedPaths.hindsightLauncher]);
}

export async function listClaudeMcp() {
  return runSafe("claude", ["mcp", "list"]);
}

export async function listCodexMcp() {
  return runSafe("codex", ["mcp", "list"]);
}
