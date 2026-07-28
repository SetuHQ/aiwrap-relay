import { exists } from "../lib/files.js";
import {
  HINDSIGHT_SERVER_NAME,
  hindsightConfig,
  hindsightInstalled,
  hindsightReachable,
  listClaudeMcp,
  listCodexMcp,
} from "../lib/hindsight.js";
import { statusLine, step } from "../lib/logger.js";
import { assertMacOS, macArch } from "../lib/platform.js";
import { AIWRAP_BIN, LOCAL_BIN, managedPaths } from "../lib/paths.js";
import { commandExists, runSafe } from "../lib/shell.js";

type DoctorOptions = {
  verbose?: boolean;
  hindsight?: boolean;
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

  for (const [name, path] of Object.entries({ aiwrap: managedPaths.aiwrap, binDir: AIWRAP_BIN, rtk: managedPaths.rtk })) {
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

  const config = await hindsightConfig();
  const setUp = await hindsightInstalled();
  const reachable = await hindsightReachable(config);
  statusLine(
    reachable ? "ok" : setUp ? "fail" : "warn",
    `Hindsight API: ${config.url}`,
    reachable
      ? `bank ${config.bank}${config.token ? "" : " (unauthenticated)"}`
      : setUp
        ? "Not responding. Start it: cd ~/hindsight && ./scripts/up.sh"
        : "Not set up on this machine. See ~/hindsight/README.md",
  );
  if (setUp && !reachable) failures++;

  // Match the exact server name — a bare "hindsight" substring would also
  // match the obsolete hindsight-mcp entry and report a false pass.
  const registered = (stdout: string) =>
    new RegExp(`(^|\\n)${HINDSIGHT_SERVER_NAME}(:|$)`, "m").test(stdout);

  if (codexPath || (await listCodexMcp()).ok) {
    const list = await listCodexMcp();
    const stale = /(^|\n)hindsight-mcp(:|$)/m.test(list.stdout);
    if (stale) statusLine("fix", "Obsolete hindsight-mcp entry in Codex config", "Run: aiwrap repair mcp");
    statusLine(list.ok && registered(list.stdout) ? "ok" : "fix", "Codex Hindsight MCP", list.ok && registered(list.stdout) ? undefined : "Run: aiwrap repair mcp");
  }
  if (claudePath) {
    const list = await listClaudeMcp();
    statusLine(list.ok && registered(list.stdout) ? "ok" : "fix", "Claude Hindsight MCP", list.ok && registered(list.stdout) ? undefined : "Run: aiwrap repair mcp");
  }

  if (options.verbose) {
    statusLine("ok", "verbose paths", `AIWRAP_BIN=${AIWRAP_BIN}\nLOCAL_BIN=${LOCAL_BIN}`);
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}
