#!/bin/sh
set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "aiwrap currently supports macOS only." >&2
  exit 1
fi

AIWRAP="$HOME/.ai-cli-wrapper/bin/aiwrap"
if [ -x "$AIWRAP" ]; then
  exec "$AIWRAP" uninstall "$@"
fi

rm -f "$HOME/.local/bin/aiwrap" "$HOME/.local/bin/codexx" "$HOME/.local/bin/claudex"
rm -rf "$HOME/.ai-cli-wrapper"
echo "aiwrap removed"
