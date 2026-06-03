#!/usr/bin/env node
import { mkdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const vendorDir = join(root, "vendor", "hindsight-mcp");
const tmpDir = join(root, ".tmp-hindsight-mcp");
const registry = process.env.NPM_CONFIG_REGISTRY || "https://registry.npmjs.org/";

await rm(vendorDir, { recursive: true, force: true });
await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

const pack = spawnSync("npm", ["pack", "hindsight-mcp", "--registry", registry, "--pack-destination", tmpDir], {
  stdio: "pipe",
  encoding: "utf8",
});

if (pack.status !== 0) {
  process.stderr.write(pack.stderr);
  process.exit(pack.status ?? 1);
}

const tarball = pack.stdout.trim().split("\n").at(-1);
if (!tarball) throw new Error("npm pack did not return a tarball name");

await mkdir(vendorDir, { recursive: true });
const extract = spawnSync("tar", ["-xzf", join(tmpDir, tarball), "-C", vendorDir, "--strip-components=1"], {
  stdio: "inherit",
});
if (extract.status !== 0) process.exit(extract.status ?? 1);

const install = spawnSync("npm", ["install", "--omit=dev", "--registry", registry], {
  cwd: vendorDir,
  stdio: "inherit",
});
if (install.status !== 0) process.exit(install.status ?? 1);

await rm(tmpDir, { recursive: true, force: true });
console.log(`Vendored hindsight-mcp into ${vendorDir}`);
