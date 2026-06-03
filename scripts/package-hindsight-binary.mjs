#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const sourceEntry = join(root, "vendor", "hindsight-mcp", "build", "index.js");
const bundleDir = join(root, "dist", "hindsight-mcp-bundle");
const bundledEntry = join(bundleDir, "index.cjs");
const outDir = join(root, "binaries");
await mkdir(outDir, { recursive: true });

const bundle = spawnSync("npx", [
  "tsup",
  sourceEntry,
  "--format",
  "cjs",
  "--target",
  "node20",
  "--platform",
  "node",
  "--out-dir",
  bundleDir,
], {
  cwd: root,
  stdio: "inherit",
});
if (bundle.status !== 0) process.exit(bundle.status ?? 1);
const packageJson = JSON.parse(await readFile(join(root, "vendor", "hindsight-mcp", "package.json"), "utf8"));
const bundledSource = await readFile(bundledEntry, "utf8");
const patchedSource = bundledSource.replace(
  /var resolvePackageVersion = \(\) => \{[\s\S]*?\n\};\nvar maybeHandleCliVersion =/,
  `var resolvePackageVersion = () => ${JSON.stringify(packageJson.version)};\nvar maybeHandleCliVersion =`,
);
if (patchedSource === bundledSource) {
  throw new Error("Failed to patch hindsight-mcp version resolver");
}
await writeFile(bundledEntry, patchedSource);

for (const arch of ["arm64", "x64"]) {
  const target = `node20-macos-${arch}`;
  const output = join(outDir, `hindsight-mcp-${arch}`);
  const result = spawnSync("pkg", [bundledEntry, "--targets", target, "--output", output], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
