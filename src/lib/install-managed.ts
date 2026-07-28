import { join } from "node:path";
import { lstat, readlink, rm, unlink } from "node:fs/promises";
import { AIWRAP_BIN, LOCAL_BIN, obsoletePaths } from "./paths.js";
import { ensureDir, safeSymlink } from "./files.js";

export async function installLaunchers() {
  await ensureDir(AIWRAP_BIN);
  await ensureDir(LOCAL_BIN);
  await removeObsoleteClientLaunchers();
  await removeObsoleteHindsightBinaries();
  const packagedProcess = process as NodeJS.Process & { pkg?: unknown };
  const aiwrapExecutable = packagedProcess.pkg ? process.execPath : process.argv[1];
  if (aiwrapExecutable) await safeSymlink(aiwrapExecutable, join(LOCAL_BIN, "aiwrap"));
}

/**
 * Drop the vendored npm `hindsight-mcp` binary and its launcher shim. That is
 * a different product from the Vectorize Hindsight service aiwrap now targets,
 * and leaving it on disk means an old Codex/Claude entry can still start it.
 */
async function removeObsoleteHindsightBinaries() {
  for (const path of Object.values(obsoletePaths)) {
    await rm(path, { force: true });
  }
}

async function removeObsoleteClientLaunchers() {
  for (const command of ["codexx", "claudex"]) {
    await rm(join(AIWRAP_BIN, command), { force: true });
    const linkPath = join(LOCAL_BIN, command);
    try {
      const existing = await lstat(linkPath);
      if (!existing.isSymbolicLink()) continue;
      const target = await readlink(linkPath);
      if (target === join(AIWRAP_BIN, command)) await unlink(linkPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
