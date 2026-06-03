import { spawn } from "node:child_process";

export type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
};

function outputToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
  if (Array.isArray(value)) return value.join("\n");
  return value == null ? "" : String(value);
}

export async function commandExists(command: string): Promise<string | null> {
  const result = await runSafe("/bin/sh", ["-lc", `command -v ${shellQuote(command)}`]);
  if (!result.ok) return null;
  return result.stdout.trim() || null;
}

export async function run(command: string, args: string[] = [], options: RunOptions = {}) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell ?? false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      const output = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === 0) resolve(output);
      else reject(Object.assign(new Error(`${command} exited with ${code}`), output));
    });
  });
}

export async function runSafe(command: string, args: string[] = [], options: RunOptions = {}) {
  try {
    const result = await run(command, args, options);
    return { ok: true as const, stdout: outputToString(result.stdout), stderr: outputToString(result.stderr) };
  } catch (error) {
    const anyError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false as const,
      stdout: outputToString(anyError.stdout),
      stderr: outputToString(anyError.stderr ?? anyError.message),
    };
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
