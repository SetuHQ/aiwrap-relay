import { macArch } from "./platform.js";
import { managedPaths } from "./paths.js";
import { exists } from "./files.js";
import { runSafe } from "./shell.js";
import { chmod, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export const RTK_VERSION = "v0.42.0";
const RTK_CHECKSUMS: Record<string, string> = {
  "rtk-aarch64-apple-darwin.tar.gz": "cddc9cd11cdf80b3342eebaba0e6ab26d9c8dec45295ea44cf98062987185724",
  "rtk-x86_64-apple-darwin.tar.gz": "3b1b9f13548599ae9d920f5e3169cc402db1930044ea24e0be4e236b7f072a99",
};

export function rtkArchiveName() {
  return macArch() === "arm64" ? "rtk-aarch64-apple-darwin.tar.gz" : "rtk-x86_64-apple-darwin.tar.gz";
}

export async function ensureManagedRtk(dryRun = false): Promise<boolean> {
  if (await exists(managedPaths.rtk)) return true;
  if (dryRun) return false;

  const archive = rtkArchiveName();
  const url = `https://github.com/rtk-ai/rtk/releases/download/${RTK_VERSION}/${archive}`;
  const tmp = `/tmp/aiwrap-${Date.now()}-${archive}`;
  const download = await runSafe("curl", ["-fsSL", url, "-o", tmp]);
  if (!download.ok) return false;
  const checksum = await runSafe("shasum", ["-a", "256", tmp]);
  if (!checksum.ok || checksum.stdout.split(/\s+/)[0] !== RTK_CHECKSUMS[archive]) return false;

  const extractDir = `/tmp/aiwrap-rtk-${Date.now()}`;
  await runSafe("mkdir", ["-p", extractDir]);
  const extract = await runSafe("tar", ["-xzf", tmp, "-C", extractDir]);
  if (!extract.ok) return false;

  const extractedRtk = await findFile(extractDir, "rtk");
  if (!extractedRtk) return false;
  await mkdir(dirname(managedPaths.rtk), { recursive: true });
  await copyFile(extractedRtk, managedPaths.rtk);
  await chmod(managedPaths.rtk, 0o755);
  return exists(managedPaths.rtk);
}

async function findFile(root: string, fileName: string): Promise<string | null> {
  for (const entry of await readdir(root)) {
    const path = join(root, entry);
    const entryStat = await stat(path);
    if (entryStat.isDirectory()) {
      const result = await findFile(path, fileName);
      if (result) return result;
    } else if (entry === fileName) {
      return path;
    }
  }
  return null;
}

export async function configureRtkForClaude(dryRun = false) {
  if (dryRun) return { ok: true, stderr: "" };
  return runSafe(managedPaths.rtk, ["init", "-g"]);
}

export async function configureRtkForCodex(dryRun = false) {
  if (dryRun) return { ok: true, stderr: "" };
  return runSafe(managedPaths.rtk, ["init", "-g", "--codex"]);
}
