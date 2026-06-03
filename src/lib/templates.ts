import { managedPaths } from "./paths.js";

export function codexxTemplate() {
  return `#!/bin/sh
set -eu
if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI not found. Install Codex, then run: aiwrap install" >&2
  exit 127
fi
exec codex "$@"
`;
}

export function claudexTemplate() {
  return `#!/bin/sh
set -eu
if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code not found. Install Claude Code, then run: aiwrap install" >&2
  exit 127
fi
exec claude "$@"
`;
}

export function hindsightLauncherTemplate() {
  return `#!/bin/sh
set -eu
exec "${managedPaths.aiwrap}" launch-hindsight-mcp "$@"
`;
}
