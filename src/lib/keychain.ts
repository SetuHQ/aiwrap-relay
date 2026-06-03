import { runSafe } from "./shell.js";

const SERVICE = "aiwrap.hindsight";
const ACCOUNT = "default";

export async function getHindsightToken(): Promise<string | null> {
  const result = await runSafe("security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"]);
  if (!result.ok) return null;
  return result.stdout.trim() || null;
}

export async function setHindsightToken(token: string): Promise<void> {
  await runSafe("security", ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT]);
  const result = await runSafe("security", [
    "add-generic-password",
    "-s",
    SERVICE,
    "-a",
    ACCOUNT,
    "-w",
    token,
    "-U",
  ]);
  if (!result.ok) {
    throw new Error(`Failed to store Hindsight token in Keychain: ${result.stderr}`);
  }
}

export async function deleteHindsightToken(): Promise<void> {
  await runSafe("security", ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT]);
}
