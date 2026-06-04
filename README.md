# aiwrap-relay

`aiwrap` configures Codex CLI and Claude Code on macOS with RTK token compression and Hindsight persistent memory, without replacing your existing `codex` or `claude` commands.

## Prerequisite

Install at least one supported AI CLI before running this installer:

- Codex CLI: https://developers.openai.com/codex/cli
- Claude Code: https://docs.anthropic.com/en/docs/claude-code

This project intentionally does not install Codex or Claude for you.

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/SetuHQ/aiwrap-relay/main/install.sh | sh
aiwrap doctor
codex
claude
```

If only Codex is installed, `aiwrap` configures Codex only. If only Claude is installed, it configures Claude only. If neither exists, install stops with clear guidance.

## What This Does

- Installs `aiwrap` under your home directory.
- Installs wrapper-managed RTK under `~/.ai-cli-wrapper/bin/rtk`.
- Configures RTK using upstream-supported setup:
  - Claude: `rtk init -g`
  - Codex: `rtk init -g --codex`
- Registers Hindsight MCP for detected clients.
- Optionally stores a Hindsight Cloud token in macOS Keychain when you configure Cloud/external API mode.
- Provides `aiwrap doctor` as the validation and repair loop.

## What This Does Not Do

- Does not install Codex CLI.
- Does not install Claude Code.
- Does not require Homebrew, npm global install, Cargo, pip, or sudo for users.
- Does not replace `codex` or `claude`.
- Does not affect browser/chat apps such as ChatGPT web or Claude.ai.
- Does not write Hindsight Cloud tokens into Codex or Claude config files.
- Does not remove unrelated MCP servers or user config.

## Commands

```bash
aiwrap install
aiwrap doctor
aiwrap doctor --verbose
aiwrap configure hindsight
aiwrap repair
aiwrap repair rtk
aiwrap repair mcp
aiwrap uninstall
```

After install, continue using your normal `codex` and `claude` commands.

## Hindsight Setup

During install, `aiwrap` registers Hindsight MCP for detected clients. It does not require a Hindsight Cloud token by default.

For Hindsight Cloud or another external Hindsight API, configure a token later:

```bash
aiwrap configure hindsight
```

Steps to create a Hindsight Cloud token:

1. Open https://ui.hindsight.vectorize.io/.
2. Go to API Settings.
3. Create a Personal Access Token.
4. Copy the token.
5. Paste it into the `aiwrap configure hindsight` prompt. Input is hidden.

Local Hindsight modes may instead need an LLM provider key such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or Ollama, depending on the mode you choose in Hindsight's docs.

Cloud tokens are stored in macOS Keychain under service `aiwrap.hindsight`, account `default`.

## Architecture

```text
codex / claude
      |
      +-- RTK configured by upstream init
      |
      +-- Hindsight MCP
              |
              +-- hindsight-mcp-launcher
                      |
                      +-- optional macOS Keychain Cloud token
                      +-- ~/.ai-cli-wrapper/bin/hindsight-mcp
```

## Files

- `~/.ai-cli-wrapper/` stores managed binaries, config, logs, and backups.
- `~/.local/bin/aiwrap` symlinks to the managed binary.
- `~/.codex/config.toml` may receive a Hindsight MCP entry through Codex MCP setup.
- Claude Code user MCP config may receive a Hindsight MCP entry through `claude mcp add --scope user`.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `aiwrap: command not found` | `~/.local/bin` is not on `PATH` | Add `export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc` |
| RTK installed but no savings | RTK init not active or client not restarted | Run `aiwrap repair rtk`, restart Codex/Claude |
| Hindsight unavailable | MCP not registered or client not restarted | Run `aiwrap repair mcp`, restart Codex/Claude |
| Hindsight Cloud auth fails | Missing or invalid Cloud token | Run `aiwrap configure hindsight` |
| macOS blocks binary | Gatekeeper quarantine | Run `xattr -d com.apple.quarantine ~/.ai-cli-wrapper/bin/<binary>` |
| Duplicate MCP server | Existing manual config | Run `aiwrap doctor --verbose` and decide whether to replace manually |

## PATH Fix

Temporary:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Persistent for zsh:

```bash
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> ~/.zshrc
exec zsh
```

## Validation

Primary acceptance test:

```bash
curl -fsSL https://raw.githubusercontent.com/SetuHQ/aiwrap-relay/main/install.sh | sh
aiwrap doctor
codex --version
claude --version
~/.ai-cli-wrapper/bin/hindsight-mcp-launcher --version
```

Pass criteria:

- No package manager required for user install.
- No `sudo`.
- Codex and Claude are not installed by `aiwrap`.
- At least one detected client is configured.
- RTK is configured using upstream mechanisms.
- Hindsight Cloud token is not stored in plaintext config.
- Hindsight MCP launcher passes arguments through to the bundled MCP binary.
- Re-running install is safe.

## Release Packaging

Build local artifacts:

```bash
npm run build:binary
npm run build:hindsight-binary
AIWRAP_PACKAGE_ARCH=arm64 npm run package:release
AIWRAP_PACKAGE_ARCH=x64 npm run package:release
```

This produces:

```text
release/aiwrap-darwin-arm64.tar.gz
release/aiwrap-darwin-x64.tar.gz
release/checksums.txt
```

Publish the tarballs and `checksums.txt` to GitLab Releases or GitHub Releases. The bootstrap installer verifies SHA-256 before extracting.

For an alternate GitHub repo, override `AIWRAP_REPO_URL`:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/aiwrap-relay/main/install.sh | \
  AIWRAP_REPO_URL="https://github.com/<owner>/aiwrap-relay" sh
```

Verify release artifacts locally:

```bash
npm run verify:release
```

Smoke-test the installer from a local tarball:

```bash
AIWRAP_LOCAL_TARBALL="$PWD/release/aiwrap-darwin-arm64.tar.gz" ./install.sh --dry-run
```

The bootstrap script extracts the tarball so it can run the packaged `aiwrap` binary. With `--dry-run`, integration setup commands are not executed.

Use `aiwrap uninstall` after a full local install test if you want to remove managed files.

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/SetuHQ/aiwrap-relay/main/uninstall.sh | sh
```

Uninstall removes only `aiwrap`-managed files and launchers. It does not uninstall Codex, Claude, or your Hindsight account data.

## Developer Setup

```bash
npm install
npm run typecheck
npm test
npm run build
node dist/cli.js doctor --verbose
```

Package manager usage is for contributors only. User releases should be standalone macOS artifacts published from GitLab Releases.

## Safety Guarantees

- We do not replace `codex` or `claude`.
- We do not store Hindsight Cloud tokens in Codex or Claude config files.
- We do not overwrite unrelated MCP servers.
- The installer is designed to be safe to re-run.
- The uninstaller removes only wrapper-managed files and config entries.

## Roadmap

- Signed and notarized binaries.
- Optional support for more local CLI clients if they expose supported RTK/MCP integration surfaces.
