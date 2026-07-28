#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const releaseDir = join(root, "release");
const checksumsPath = join(releaseDir, "checksums.txt");
const requiredFiles = [
  "aiwrap/bin/aiwrap",
  "aiwrap/VERSION",
];

// Files that must NOT ship any more: the vendored npm `hindsight-mcp` (an
// unrelated product) and its stdio launcher. Asserting their absence keeps a
// stale build from silently reintroducing them.
const forbiddenFiles = [
  "aiwrap/bin/hindsight-mcp",
  "aiwrap/bin/hindsight-mcp-launcher",
];

const checksums = await parseChecksums(checksumsPath);
for (const archive of ["aiwrap-darwin-arm64.tar.gz", "aiwrap-darwin-x64.tar.gz"]) {
  await verifyArchive(archive, checksums.get(archive));
}

console.log("release verification passed");

async function parseChecksums(path) {
  if (!existsSync(path)) throw new Error(`Missing ${path}`);
  const map = new Map();
  for (const line of (await readFile(path, "utf8")).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [hash, file] = trimmed.split(/\s+/);
    map.set(file, hash);
  }
  return map;
}

async function verifyArchive(archiveName, expectedChecksum) {
  if (!expectedChecksum) throw new Error(`Missing checksum for ${archiveName}`);
  const archivePath = join(releaseDir, archiveName);
  if (!existsSync(archivePath)) throw new Error(`Missing ${archivePath}`);

  const actualChecksum = createHash("sha256").update(await readFile(archivePath)).digest("hex");
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`Checksum mismatch for ${archiveName}: expected ${expectedChecksum}, got ${actualChecksum}`);
  }

  const list = spawnSync("tar", ["-tzf", archivePath], { encoding: "utf8" });
  if (list.status !== 0) throw new Error(`Failed to list ${archiveName}: ${list.stderr}`);
  const entries = new Set(list.stdout.trim().split("\n"));
  for (const file of requiredFiles) {
    if (!entries.has(file)) throw new Error(`${archiveName} missing ${file}`);
  }
  for (const file of forbiddenFiles) {
    if (entries.has(file)) throw new Error(`${archiveName} still ships obsolete ${file}`);
  }

  const extractDir = await mkdtemp(join(tmpdir(), `aiwrap-${basename(archiveName, ".tar.gz")}-`));
  try {
    const extract = spawnSync("tar", ["-xzf", archivePath, "-C", extractDir], { encoding: "utf8" });
    if (extract.status !== 0) throw new Error(`Failed to extract ${archiveName}: ${extract.stderr}`);
    for (const file of requiredFiles.filter((file) => file.includes("/bin/"))) {
      const mode = (await stat(join(extractDir, file))).mode;
      if ((mode & 0o111) === 0) throw new Error(`${archiveName} ${file} is not executable`);
    }
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}
