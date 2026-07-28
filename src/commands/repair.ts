import {
  hindsightConfig,
  hindsightReachable,
  registerClaudeHindsight,
  registerCodexHindsight,
  removeStaleHindsightMcp,
} from "../lib/hindsight.js";
import { installLaunchers } from "../lib/install-managed.js";
import { statusLine, step } from "../lib/logger.js";
import { assertMacOS } from "../lib/platform.js";
import { commandExists } from "../lib/shell.js";
import { configureRtkForClaude, configureRtkForCodex, ensureManagedRtk } from "../lib/rtk.js";

export async function repairCommand(target = "all") {
  assertMacOS();
  step(`Repairing ${target}`);
  const codex = Boolean(await commandExists("codex"));
  const claude = Boolean(await commandExists("claude"));

  if (target === "all" || target === "permissions") {
    await installLaunchers();
    statusLine("ok", "Managed launchers repaired");
  }

  if (target === "all" || target === "rtk") {
    const ready = await ensureManagedRtk(false);
    statusLine(ready ? "ok" : "fail", "RTK repaired", ready ? undefined : "Check network or pinned RTK release URL.");
    if (ready && claude) await configureRtkForClaude(false);
    if (ready && codex) await configureRtkForCodex(false);
  }

  if (target === "all" || target === "mcp") {
    const cleared = await removeStaleHindsightMcp();
    if (cleared.length) statusLine("ok", `Removed obsolete hindsight-mcp entry from: ${cleared.join(", ")}`);

    const config = await hindsightConfig();
    const reachable = await hindsightReachable(config);
    statusLine(reachable ? "ok" : "warn", `Hindsight API: ${config.url}`, reachable ? undefined : "Not responding. Start it: cd ~/hindsight && ./scripts/up.sh");

    // Register regardless of reachability — the config is still correct when
    // the service is merely stopped, and re-running once it is up is a no-op.
    const codexResult = await registerCodexHindsight(false);
    statusLine(codexResult.ok ? "ok" : "warn", "Codex Hindsight MCP", codexResult.ok ? undefined : codexResult.stderr);
    if (claude) {
      const claudeResult = await registerClaudeHindsight(false);
      statusLine(claudeResult.ok ? "ok" : "warn", "Claude Hindsight MCP", claudeResult.ok ? undefined : claudeResult.stderr);
    }
    if (!codex) statusLine("skip", "Codex CLI not on PATH", "Config file was still updated for the Codex desktop app.");
  }
}
