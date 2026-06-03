#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const dist = join(root, "release");
const version = JSON.parse(await readFile(join(root, "package.json"), "utf8")).version;
const arch = process.env.AIWRAP_PACKAGE_ARCH ?? process.arch;
const releaseArch = arch === "arm64" ? "arm64" : "x64";
const packageName = `aiwrap-darwin-${releaseArch}`;
const packageDir = join(dist, packageName, "aiwrap");
const binDir = join(packageDir, "bin");

await mkdir(dist, { recursive: true });
await rm(join(dist, packageName), { recursive: true, force: true });
await mkdir(binDir, { recursive: true });

const packagedCli = join(root, "binaries", `cli-${releaseArch}`);
const packagedHindsight = join(root, "binaries", `hindsight-mcp-${releaseArch}`);
if (!existsSync(packagedCli)) throw new Error(`Missing ${packagedCli}. Run npm run build:binary first.`);
if (!existsSync(packagedHindsight)) throw new Error(`Missing ${packagedHindsight}. Run npm run build:hindsight-binary first.`);

await copyFile(packagedCli, join(binDir, "aiwrap"));
await chmod(join(binDir, "aiwrap"), 0o755);
await writeFile(join(binDir, "codexx"), `#!/bin/sh\nset -eu\nif ! command -v codex >/dev/null 2>&1; then\n  echo "Codex CLI not found. Install Codex, then run: aiwrap install" >&2\n  exit 127\nfi\nexec codex "$@"\n`, { mode: 0o755 });
await writeFile(join(binDir, "claudex"), `#!/bin/sh\nset -eu\nif ! command -v claude >/dev/null 2>&1; then\n  echo "Claude Code not found. Install Claude Code, then run: aiwrap install" >&2\n  exit 127\nfi\nexec claude "$@"\n`, { mode: 0o755 });
await writeFile(join(binDir, "hindsight-mcp-launcher"), `#!/bin/sh
set -eu
exec "$HOME/.ai-cli-wrapper/bin/aiwrap" launch-hindsight-mcp "$@"
`, { mode: 0o755 });

await copyFile(packagedHindsight, join(binDir, "hindsight-mcp"));
await chmod(join(binDir, "hindsight-mcp"), 0o755);
await writeFile(join(packageDir, "VERSION"), `${version}\n`);

const tarball = join(dist, `${packageName}.tar.gz`);
const tar = spawnSync("tar", ["-czf", tarball, "-C", join(dist, packageName), "aiwrap"], { stdio: "inherit" });
if (tar.status !== 0) process.exit(tar.status ?? 1);

const data = await readFile(tarball);
const checksum = createHash("sha256").update(data).digest("hex");
const checksumPath = join(dist, "checksums.txt");
const existingChecksums = existsSync(checksumPath) ? await readFile(checksumPath, "utf8") : "";
const nextChecksums = existingChecksums
  .split("\n")
  .filter((line) => line.trim() && !line.endsWith(`  ${basename(tarball)}`))
  .concat(`${checksum}  ${basename(tarball)}`)
  .join("\n");
await writeFile(checksumPath, `${nextChecksums}\n`);
console.log(`Created ${tarball}`);
console.log(`sha256 ${checksum}`);
