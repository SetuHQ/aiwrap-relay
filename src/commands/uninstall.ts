import { confirm } from "@inquirer/prompts";
import { rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "../lib/files.js";
import { deleteHindsightToken } from "../lib/keychain.js";
import { info, statusLine, step } from "../lib/logger.js";
import { assertMacOS } from "../lib/platform.js";
import { AIWRAP_HOME, LOCAL_BIN } from "../lib/paths.js";

type UninstallOptions = { yes?: boolean; keepKeychain?: boolean };

export async function uninstallCommand(options: UninstallOptions) {
  assertMacOS();
  step("Uninstall aiwrap");
  info(`Will remove:
  ${AIWRAP_HOME}
  ${join(LOCAL_BIN, "aiwrap")}
  ${join(LOCAL_BIN, "codexx")}
  ${join(LOCAL_BIN, "claudex")}

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
  for (const command of ["aiwrap", "codexx", "claudex"]) {
    const path = join(LOCAL_BIN, command);
    if (await exists(path)) await unlink(path);
  }
  if (await exists(AIWRAP_HOME)) await rm(AIWRAP_HOME, { recursive: true, force: true });
  if (!options.keepKeychain) await deleteHindsightToken();
  statusLine("ok", "aiwrap removed");
}
