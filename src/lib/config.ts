import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AIWRAP_CONFIG } from "./paths.js";

export type AiwrapConfig = {
  hindsight?: {
    baseUrl?: string;
    defaultAgentId?: string;
    defaultConversationId?: string;
  };
  experimentalCodexShims?: boolean;
};

export async function readConfig(): Promise<AiwrapConfig> {
  try {
    return JSON.parse(await readFile(AIWRAP_CONFIG, "utf8")) as AiwrapConfig;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return {};
    throw error;
  }
}

export async function writeConfig(config: AiwrapConfig) {
  await mkdir(dirname(AIWRAP_CONFIG), { recursive: true });
  await writeFile(AIWRAP_CONFIG, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
