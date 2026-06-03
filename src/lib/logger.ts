import pc from "picocolors";

export type Status = "ok" | "skip" | "warn" | "fix" | "fail";

const colors: Record<Status, (value: string) => string> = {
  ok: pc.green,
  skip: pc.gray,
  warn: pc.yellow,
  fix: pc.cyan,
  fail: pc.red,
};

export function statusLine(status: Status, message: string, detail?: string) {
  const label = colors[status](status.padEnd(5));
  console.log(`${label} ${message}`);
  if (detail) {
    for (const line of detail.split("\n")) {
      console.log(`      ${line}`);
    }
  }
}

export function step(message: string) {
  console.log(pc.bold(`\n${message}`));
}

export function info(message: string) {
  console.log(message);
}
