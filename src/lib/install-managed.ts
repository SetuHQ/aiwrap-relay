import { join } from "node:path";
import { AIWRAP_BIN, LOCAL_BIN, managedPaths } from "./paths.js";
import { ensureDir, safeSymlink, writeExecutable } from "./files.js";
import { claudexTemplate, codexxTemplate, hindsightLauncherTemplate } from "./templates.js";

export async function installLaunchers(targets: { codex: boolean; claude: boolean }) {
  await ensureDir(AIWRAP_BIN);
  await ensureDir(LOCAL_BIN);
  await writeExecutable(managedPaths.hindsightLauncher, hindsightLauncherTemplate());
  if (targets.codex) {
    await writeExecutable(managedPaths.codexx, codexxTemplate());
    await safeSymlink(managedPaths.codexx, join(LOCAL_BIN, "codexx"));
  }
  if (targets.claude) {
    await writeExecutable(managedPaths.claudex, claudexTemplate());
    await safeSymlink(managedPaths.claudex, join(LOCAL_BIN, "claudex"));
  }
  const packagedProcess = process as NodeJS.Process & { pkg?: unknown };
  const aiwrapExecutable = packagedProcess.pkg ? process.execPath : process.argv[1];
  if (aiwrapExecutable) await safeSymlink(aiwrapExecutable, join(LOCAL_BIN, "aiwrap"));
}
