import { input, password } from "@inquirer/prompts";
import { readConfig, writeConfig } from "../lib/config.js";
import { setHindsightToken } from "../lib/keychain.js";
import { info, statusLine, step } from "../lib/logger.js";
import { assertMacOS } from "../lib/platform.js";

export async function configureHindsightCommand() {
  assertMacOS();
  step("Hindsight Memory Setup");
  info(`Steps:
  1. Open your Hindsight dashboard.
  2. Go to API Settings.
  3. Create a Personal Access Token.
  4. Grant memory read/write scopes.
  5. Copy the token.
  6. Paste it here. Input will be hidden.

Press Enter to skip. You can run this again with: aiwrap configure hindsight`);

  const baseUrl = await input({ message: "Hindsight API base URL", default: "https://api.hindsight-ai.com" });
  const token = await password({ message: "Hindsight API token (hidden, optional)", mask: "*" });
  const defaultAgentId = await input({ message: "Default agent ID (optional)", required: false });
  const defaultConversationId = await input({ message: "Default conversation ID (optional)", required: false });

  const config = await readConfig();
  config.hindsight = {
    baseUrl: baseUrl || "https://api.hindsight-ai.com",
    ...(defaultAgentId ? { defaultAgentId } : {}),
    ...(defaultConversationId ? { defaultConversationId } : {}),
  };
  await writeConfig(config);

  if (token) {
    await setHindsightToken(token);
    statusLine("ok", "Hindsight token stored in macOS Keychain");
  } else {
    statusLine("warn", "Hindsight token skipped", "Run: aiwrap configure hindsight");
  }
}
