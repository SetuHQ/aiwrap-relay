import { ensureManagedHindsightMcp, registerClaudeHindsight, registerCodexHindsight } from "../lib/hindsight.js";
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
    await installLaunchers({ codex, claude });
    statusLine("ok", "Launchers repaired");
  }

  if (target === "all" || target === "rtk") {
    const ready = await ensureManagedRtk(false);
    statusLine(ready ? "ok" : "fail", "RTK repaired", ready ? undefined : "Check network or pinned RTK release URL.");
    if (ready && claude) await configureRtkForClaude(false);
    if (ready && codex) await configureRtkForCodex(false);
  }

  if (target === "all" || target === "mcp") {
    const ready = await ensureManagedHindsightMcp();
    statusLine(ready ? "ok" : "warn", "Hindsight MCP binary", ready ? undefined : "Bundle hindsight-mcp into the release first.");
    if (ready && codex) await registerCodexHindsight(false);
    if (ready && claude) await registerClaudeHindsight(false);
  }
}
