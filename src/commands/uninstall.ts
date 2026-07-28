import { confirm } from "@inquirer/prompts";
import { lstat, readlink, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "../lib/files.js";
import { info, statusLine, step } from "../lib/logger.js";
import { assertMacOS } from "../lib/platform.js";
import { AIWRAP_HOME, LOCAL_BIN } from "../lib/paths.js";

type UninstallOptions = { yes?: boolean };

export async function uninstallCommand(options: UninstallOptions) {
  assertMacOS();
  step("Uninstall aiwrap");
  info(`Will remove:
  ${AIWRAP_HOME}
  ${join(LOCAL_BIN, "aiwrap")}

Will not remove:
  codex
  claude
  unrelated user config
  Hindsight account data`);

  const proceed = options.yes || await confirm({ message: "Continue?", default: false });
  if (!proceed) {
    statusLine("skip", "Uninstall cancelled");
    return;
  }
  for (const command of ["aiwrap", "codexx", "claudex"]) await unlinkIfManaged(command);
  if (await exists(AIWRAP_HOME)) await rm(AIWRAP_HOME, { recursive: true, force: true });
  statusLine("ok", "aiwrap removed");
}

async function unlinkIfManaged(command: string) {
  const path = join(LOCAL_BIN, command);
  try {
    const existing = await lstat(path);
    if (!existing.isSymbolicLink()) return;
    const target = await readlink(path);
    if (target.startsWith(`${AIWRAP_HOME}/`)) await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
