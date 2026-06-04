import { spawn } from "node:child_process";
import { managedPaths } from "../lib/paths.js";

export async function launchHindsightMcpCommand(args: string[]) {
  const env = { ...process.env };

  await new Promise<void>((resolve, reject) => {
    const child = spawn(managedPaths.hindsightMcp, args, {
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}
