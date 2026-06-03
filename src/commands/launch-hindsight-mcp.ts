import { spawn } from "node:child_process";
import { readConfig } from "../lib/config.js";
import { getHindsightToken } from "../lib/keychain.js";
import { managedPaths } from "../lib/paths.js";

export async function launchHindsightMcpCommand(args: string[]) {
  const config = await readConfig();
  const token = await getHindsightToken();
  const env = { ...process.env };

  if (token) env.HINDSIGHT_API_TOKEN = token;
  if (config.hindsight?.baseUrl) env.HINDSIGHT_API_BASE_URL = config.hindsight.baseUrl;
  if (config.hindsight?.defaultAgentId) env.DEFAULT_AGENT_ID = config.hindsight.defaultAgentId;
  if (config.hindsight?.defaultConversationId) env.DEFAULT_CONVERSATION_ID = config.hindsight.defaultConversationId;

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
