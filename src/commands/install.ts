import { exists } from "../lib/files.js";
import {
  hindsightConfig,
  hindsightInstalled,
  hindsightReachable,
  registerClaudeHindsight,
  registerCodexHindsight,
  removeStaleHindsightMcp,
} from "../lib/hindsight.js";
import { installLaunchers } from "../lib/install-managed.js";
import { info, statusLine, step } from "../lib/logger.js";
import { assertMacOS, macArch } from "../lib/platform.js";
import { managedPaths } from "../lib/paths.js";
import { commandExists } from "../lib/shell.js";
import { configureRtkForClaude, configureRtkForCodex, ensureManagedRtk } from "../lib/rtk.js";
import { doctorCommand } from "./doctor.js";

type InstallOptions = {
  codexOnly?: boolean;
  claudeOnly?: boolean;
  rtk?: boolean;
  hindsight?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  verbose?: boolean;
};

export async function installCommand(options: InstallOptions) {
  assertMacOS();
  step("Installing aiwrap");
  info(`macOS architecture: ${macArch()}`);

  const codexPath = options.claudeOnly ? null : await commandExists("codex");
  const claudePath = options.codexOnly ? null : await commandExists("claude");
  if (!codexPath && !claudePath) {
    throw new Error(`Codex CLI or Claude Code is required first.

Install at least one:
  Codex: https://developers.openai.com/codex/cli
  Claude Code: https://docs.anthropic.com/en/docs/claude-code

Then rerun:
  aiwrap install`);
  }

  statusLine(codexPath ? "ok" : "skip", codexPath ? `Codex found: ${codexPath}` : "Codex not found");
  statusLine(claudePath ? "ok" : "skip", claudePath ? `Claude found: ${claudePath}` : "Claude not found");

  if (!options.dryRun) {
    await installLaunchers();
  }

  if (options.rtk !== false) {
    const rtkReady = await ensureManagedRtk(Boolean(options.dryRun));
    statusLine(
      rtkReady ? "ok" : options.dryRun ? "fix" : "fail",
      rtkReady ? `RTK ready: ${managedPaths.rtk}` : options.dryRun ? "RTK would be installed" : "RTK could not be installed",
      rtkReady ? undefined : options.dryRun ? undefined : "Run: aiwrap repair rtk",
    );
    if (rtkReady && claudePath) {
      const result = await configureRtkForClaude(Boolean(options.dryRun));
      statusLine(result.ok ? "ok" : "fix", "RTK Claude setup", result.ok ? undefined : "Run: aiwrap repair rtk");
    }
    if (rtkReady && codexPath) {
      const result = await configureRtkForCodex(Boolean(options.dryRun));
      statusLine(result.ok ? "ok" : "fix", "RTK Codex setup", result.ok ? undefined : "Run: aiwrap repair rtk");
    }
  }

  if (options.hindsight !== false) {
    if (!options.dryRun) {
      const cleared = await removeStaleHindsightMcp();
      if (cleared.length) {
        statusLine("ok", `Removed obsolete hindsight-mcp entry from: ${cleared.join(", ")}`, "That was the unrelated npm hindsight-mcp, not Vectorize Hindsight.");
      }
    }

    const config = await hindsightConfig();
    const setUp = await hindsightInstalled();
    const reachable = await hindsightReachable(config);

    if (!setUp && !reachable) {
      statusLine("warn", "Hindsight service not found", `Set it up at ~/hindsight, then run: aiwrap repair mcp\nExpected API at ${config.url}`);
    } else {
      statusLine(reachable ? "ok" : "warn", `Hindsight API: ${config.url}`, reachable ? undefined : "Not responding. Start it: cd ~/hindsight && ./scripts/up.sh");
      if (codexPath) {
        const result = await registerCodexHindsight(Boolean(options.dryRun));
        statusLine(result.ok ? "ok" : "fix", "Codex Hindsight MCP registration", result.ok ? undefined : "Run: aiwrap repair mcp");
      }
      if (claudePath) {
        const result = await registerClaudeHindsight(Boolean(options.dryRun));
        statusLine(result.ok ? "ok" : "fix", "Claude Hindsight MCP registration", result.ok ? undefined : "Run: aiwrap repair mcp");
      }
    }
  }

  if (!options.dryRun && !(await exists(managedPaths.aiwrap))) {
    statusLine("warn", "Standalone aiwrap binary is not installed in ~/.ai-cli-wrapper/bin yet", "Release packaging should place it there.");
  }

  if (options.dryRun) {
    statusLine("ok", "Dry run complete", "No integration commands were executed. Run without --dry-run to install.");
    return;
  }

  await doctorCommand({ verbose: options.verbose });
}
