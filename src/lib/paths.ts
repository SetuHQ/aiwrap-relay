import { homedir } from "node:os";
import { join } from "node:path";

export const HOME = homedir();
export const AIWRAP_HOME = join(HOME, ".ai-cli-wrapper");
export const AIWRAP_BIN = join(AIWRAP_HOME, "bin");
export const AIWRAP_BACKUPS = join(AIWRAP_HOME, "backups");
export const AIWRAP_LOGS = join(AIWRAP_HOME, "logs");
export const LOCAL_BIN = join(HOME, ".local", "bin");
export const CODEX_CONFIG = join(HOME, ".codex", "config.toml");
export const CLAUDE_SETTINGS = join(HOME, ".claude", "settings.json");

export const managedPaths = {
  aiwrap: join(AIWRAP_BIN, "aiwrap"),
  rtk: join(AIWRAP_BIN, "rtk"),
};

/**
 * Left behind by aiwrap <= 0.1.2, which vendored the unrelated npm
 * `hindsight-mcp` package and ran it over stdio. Removed on install/repair.
 */
export const obsoletePaths = {
  hindsightMcp: join(AIWRAP_BIN, "hindsight-mcp"),
  hindsightLauncher: join(AIWRAP_BIN, "hindsight-mcp-launcher"),
};
