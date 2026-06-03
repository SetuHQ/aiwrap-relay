#!/bin/sh
set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "aiwrap currently supports macOS only." >&2
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  arm64) ASSET="aiwrap-darwin-arm64.tar.gz" ;;
  x86_64) ASSET="aiwrap-darwin-x64.tar.gz" ;;
  *) echo "Unsupported macOS architecture: $ARCH" >&2; exit 1 ;;
esac

REPO_URL="${AIWRAP_REPO_URL:-https://gitlab.com/brokentusk/platform/aiwrap-relay}"
VERSION="${AIWRAP_VERSION:-latest}"
INSTALL_DIR="$HOME/.ai-cli-wrapper"
LOCAL_BIN="$HOME/.local/bin"
DRY_RUN=0
CLEANUP_DIRS=""
cleanup() {
  for dir in $CLEANUP_DIRS; do
    rm -rf "$dir"
  done
}
download() {
  if [ -n "${GITLAB_TOKEN:-}" ]; then
    curl -fsSL -H "PRIVATE-TOKEN: $GITLAB_TOKEN" "$1" -o "$2"
  else
    curl -fsSL "$1" -o "$2"
  fi
}
trap cleanup EXIT INT TERM
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    DRY_RUN=1
  fi
done

if [ -n "${AIWRAP_LOCAL_TARBALL:-}" ]; then
  TARBALL="$AIWRAP_LOCAL_TARBALL"
else
  TMPDIR="$(mktemp -d)"
  CLEANUP_DIRS="$CLEANUP_DIRS $TMPDIR"
  TARBALL="$TMPDIR/$ASSET"
  CHECKSUMS="$TMPDIR/checksums.txt"
  if [ "$VERSION" = "latest" ]; then
    URL="$REPO_URL/-/releases/permalink/latest/downloads/$ASSET"
    CHECKSUM_URL="$REPO_URL/-/releases/permalink/latest/downloads/checksums.txt"
  else
    URL="$REPO_URL/-/releases/$VERSION/downloads/$ASSET"
    CHECKSUM_URL="$REPO_URL/-/releases/$VERSION/downloads/checksums.txt"
  fi
  echo "Downloading $URL"
  download "$URL" "$TARBALL"
  echo "Downloading $CHECKSUM_URL"
  download "$CHECKSUM_URL" "$CHECKSUMS"
  EXPECTED="$(awk -v file="$ASSET" '$2 == file { print $1 }' "$CHECKSUMS")"
  if [ -z "$EXPECTED" ]; then
    echo "No checksum found for $ASSET" >&2
    exit 1
  fi
  ACTUAL="$(shasum -a 256 "$TARBALL" | awk '{ print $1 }')"
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "Checksum mismatch for $ASSET" >&2
    echo "expected: $EXPECTED" >&2
    echo "actual:   $ACTUAL" >&2
    exit 1
  fi
fi

if [ "$DRY_RUN" = "1" ]; then
  EXTRACT_DIR="$(mktemp -d)"
  CLEANUP_DIRS="$CLEANUP_DIRS $EXTRACT_DIR"
  tar -xzf "$TARBALL" -C "$EXTRACT_DIR"
  chmod +x "$EXTRACT_DIR/aiwrap/bin/aiwrap" 2>/dev/null || true
  "$EXTRACT_DIR/aiwrap/bin/aiwrap" install "$@"
  exit $?
fi

mkdir -p "$INSTALL_DIR" "$LOCAL_BIN"
tar -xzf "$TARBALL" -C "$INSTALL_DIR" --strip-components=1
chmod +x "$INSTALL_DIR/bin/aiwrap" "$INSTALL_DIR/bin/codexx" "$INSTALL_DIR/bin/claudex" "$INSTALL_DIR/bin/hindsight-mcp-launcher" "$INSTALL_DIR/bin/hindsight-mcp" 2>/dev/null || true
AIWRAP_LINK="$LOCAL_BIN/aiwrap"
AIWRAP_TARGET="$INSTALL_DIR/bin/aiwrap"
if [ -L "$AIWRAP_LINK" ]; then
  CURRENT_TARGET="$(readlink "$AIWRAP_LINK" || true)"
  if [ "$CURRENT_TARGET" != "$AIWRAP_TARGET" ]; then
    rm "$AIWRAP_LINK"
  fi
elif [ -e "$AIWRAP_LINK" ]; then
  echo "$AIWRAP_LINK already exists and is not a symlink. Move it before installing aiwrap." >&2
  exit 1
fi
if [ ! -L "$AIWRAP_LINK" ]; then
  ln -s "$AIWRAP_TARGET" "$AIWRAP_LINK"
fi

if ! printf '%s' ":$PATH:" | grep -q ":$LOCAL_BIN:"; then
  echo ""
  echo "Warning: $LOCAL_BIN is not on PATH. Add this to ~/.zshrc:"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

"$INSTALL_DIR/bin/aiwrap" install "$@"
