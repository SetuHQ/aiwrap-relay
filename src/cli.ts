#!/usr/bin/env node
import { Command } from "commander";
import { installCommand } from "./commands/install.js";
import { doctorCommand } from "./commands/doctor.js";
import { repairCommand } from "./commands/repair.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { launchHindsightMcpCommand } from "./commands/launch-hindsight-mcp.js";

if (process.argv[2] === "launch-hindsight-mcp") {
  launchHindsightMcpCommand(process.argv.slice(3)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
} else {
const program = new Command();

program
  .name("aiwrap")
  .description("macOS wrapper for Codex and Claude with RTK and Hindsight MCP")
  .version("0.1.2");

program
  .command("install")
  .description("install aiwrap support files and configure detected AI CLIs")
  .option("--codex-only", "configure Codex only")
  .option("--claude-only", "configure Claude only")
  .option("--no-rtk", "skip RTK setup")
  .option("--no-hindsight", "skip Hindsight MCP setup")
  .option("--dry-run", "show actions without changing files")
  .option("--yes", "accept non-secret prompts")
  .option("--verbose", "print detailed diagnostics")
  .action(installCommand);

program
  .command("doctor")
  .description("validate installation and print repair guidance")
  .option("--verbose", "print detailed diagnostics")
  .option("--hindsight", "include Hindsight checks")
  .action(doctorCommand);

program
  .command("repair")
  .description("repair managed files or integrations")
  .argument("[target]", "repair target: all, rtk, mcp, permissions", "all")
  .option("--verbose", "print detailed diagnostics")
  .action(repairCommand);

program
  .command("uninstall")
  .description("remove aiwrap-managed files and config entries")
  .option("--yes", "do not prompt")
  .action(uninstallCommand);

program
  .command("launch-hindsight-mcp", { hidden: true })
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .argument("[args...]", "arguments passed to hindsight-mcp")
  .action(launchHindsightMcpCommand);

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
}
