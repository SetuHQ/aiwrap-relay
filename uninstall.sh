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

for command in aiwrap codexx claudex; do
  path="$HOME/.local/bin/$command"
  if [ -L "$path" ]; then
    target="$(readlink "$path" || true)"
    case "$target" in
      "$HOME/.ai-cli-wrapper"/*) rm -f "$path" ;;
    esac
  fi
done
rm -rf "$HOME/.ai-cli-wrapper"
echo "aiwrap removed"
