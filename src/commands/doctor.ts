import { exists } from "../lib/files.js";
import { ensureManagedHindsightMcp, listClaudeMcp, listCodexMcp } from "../lib/hindsight.js";
import { getHindsightToken } from "../lib/keychain.js";
import { statusLine, step } from "../lib/logger.js";
import { assertMacOS, macArch } from "../lib/platform.js";
import { AIWRAP_BIN, LOCAL_BIN, managedPaths } from "../lib/paths.js";
import { commandExists, runSafe } from "../lib/shell.js";

type DoctorOptions = {
  verbose?: boolean;
  hindsight?: boolean;
  requireHindsight?: boolean;
};

export async function doctorCommand(options: DoctorOptions = {}) {
  assertMacOS();
  let failures = 0;
  step("aiwrap doctor");
  statusLine("ok", `macOS architecture: ${macArch()}`);

  const codexPath = await commandExists("codex");
  const claudePath = await commandExists("claude");
  if (!codexPath && !claudePath) {
    failures++;
    statusLine("fail", "Codex and Claude are both missing", "Install at least one, then run: aiwrap install");
  } else {
    statusLine(codexPath ? "ok" : "skip", codexPath ? `Codex found: ${codexPath}` : "Codex not found");
    statusLine(claudePath ? "ok" : "skip", claudePath ? `Claude found: ${claudePath}` : "Claude not found");
  }

  const pathValue = process.env.PATH ?? "";
  const localBinOnPath = pathValue.split(":").includes(LOCAL_BIN);
  statusLine(localBinOnPath ? "ok" : "warn", `${LOCAL_BIN} on PATH`, localBinOnPath ? undefined : `Add to ~/.zshrc: export PATH="$HOME/.local/bin:$PATH"`);

  for (const [name, path] of Object.entries({ aiwrap: managedPaths.aiwrap, binDir: AIWRAP_BIN, rtk: managedPaths.rtk, hindsightLauncher: managedPaths.hindsightLauncher })) {
    const present = await exists(path);
    if (!present && name === "rtk" && (codexPath || claudePath)) failures++;
    statusLine(present ? "ok" : name === "rtk" ? "fail" : "warn", `${name}: ${path}`, present ? undefined : `Run: aiwrap repair ${name === "rtk" ? "rtk" : "permissions"}`);
  }

  const shellRtk = await commandExists("rtk");
  if (shellRtk && shellRtk !== managedPaths.rtk) {
    statusLine("warn", "Multiple RTK binaries may exist", `shell: ${shellRtk}\nwrapper: ${managedPaths.rtk}\naiwrap uses the wrapper-managed RTK.`);
  }

  if (await exists(managedPaths.rtk)) {
    const rtkVersion = await runSafe(managedPaths.rtk, ["--version"]);
    statusLine(rtkVersion.ok ? "ok" : "fail", "RTK executable", rtkVersion.ok ? rtkVersion.stdout : "Run: aiwrap repair rtk");
    if (!rtkVersion.ok) failures++;
  }

  const hindsightMcp = await ensureManagedHindsightMcp();
  statusLine(hindsightMcp ? "ok" : "warn", "Hindsight MCP binary", hindsightMcp ? managedPaths.hindsightMcp : "Bundle ~/.ai-cli-wrapper/bin/hindsight-mcp in the release.");
  const token = await getHindsightToken();
  if (!token && options.requireHindsight) failures++;
  statusLine(token ? "ok" : options.requireHindsight ? "fail" : "warn", "Hindsight token", token ? "Stored in macOS Keychain" : "Run: aiwrap configure hindsight");

  if (codexPath) {
    const list = await listCodexMcp();
    statusLine(list.ok && list.stdout.includes("hindsight") ? "ok" : "fix", "Codex Hindsight MCP", list.ok && list.stdout.includes("hindsight") ? undefined : "Run: aiwrap repair mcp");
  }
  if (claudePath) {
    const list = await listClaudeMcp();
    statusLine(list.ok && list.stdout.includes("hindsight") ? "ok" : "fix", "Claude Hindsight MCP", list.ok && list.stdout.includes("hindsight") ? undefined : "Run: aiwrap repair mcp");
  }

  if (options.verbose) {
    statusLine("ok", "verbose paths", `AIWRAP_BIN=${AIWRAP_BIN}\nLOCAL_BIN=${LOCAL_BIN}`);
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}
