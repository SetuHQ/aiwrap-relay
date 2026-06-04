import { managedPaths } from "./paths.js";

export function hindsightLauncherTemplate() {
  return `#!/bin/sh
set -eu
exec "${managedPaths.aiwrap}" launch-hindsight-mcp "$@"
`;
}
