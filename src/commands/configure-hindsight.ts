import { input, password } from "@inquirer/prompts";
import { readConfig, writeConfig } from "../lib/config.js";
import { setHindsightToken } from "../lib/keychain.js";
import { info, statusLine, step } from "../lib/logger.js";
import { assertMacOS } from "../lib/platform.js";

export async function configureHindsightCommand() {
  assertMacOS();
  step("Configure Hindsight Cloud");
  info(`A Hindsight Cloud token is only needed when connecting to Hindsight Cloud or another external Hindsight API.

Local Hindsight modes do not need a Hindsight token. Some local modes may need an LLM provider key instead, such as OPENAI_API_KEY, ANTHROPIC_API_KEY, or Ollama.

For Hindsight Cloud:
  1. Open https://ui.hindsight.vectorize.io/
  2. Sign in or create an account.
  3. Open API Settings.
  4. Create a Personal Access Token.
  5. Paste it here. Input will be hidden.

Press Enter to skip. You can run this again with: aiwrap configure hindsight`);

  const baseUrl = await input({ message: "Hindsight API base URL", default: "https://api.hindsight.vectorize.io" });
  const token = await password({ message: "Hindsight Cloud/API token (hidden, optional)", mask: "*" });
  const defaultAgentId = await input({ message: "Default agent ID (optional)", required: false });
  const defaultConversationId = await input({ message: "Default conversation ID (optional)", required: false });

  const config = await readConfig();
  config.hindsight = {
    baseUrl: baseUrl || "https://api.hindsight.vectorize.io",
    ...(defaultAgentId ? { defaultAgentId } : {}),
    ...(defaultConversationId ? { defaultConversationId } : {}),
  };
  await writeConfig(config);

  if (token) {
    await setHindsightToken(token);
    statusLine("ok", "Hindsight Cloud token stored in macOS Keychain");
  } else {
    statusLine("skip", "Hindsight Cloud token skipped", "Local Hindsight modes may not need one.");
  }
}
