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
- Registers the self-hosted Hindsight MCP endpoint for detected clients.
- Removes the obsolete vendored `hindsight-mcp` binary and its client entries.
- Provides `aiwrap doctor` as the validation and repair loop.

## What This Does Not Do

- Does not install Codex CLI.
- Does not install Claude Code.
- Does not require Homebrew, npm global install, Cargo, pip, or sudo for users.
- Does not replace `codex` or `claude`.
- Does not affect browser/chat apps such as ChatGPT web or Claude.ai.
- Does not run, install, or bundle a Hindsight server — it only points clients at yours.
- Does not configure Hindsight Cloud. It reads the local tenant token from
  `~/hindsight/.env` and never writes to that file.
- Does not remove unrelated MCP servers or user config. The one exception is the obsolete
  `hindsight-mcp` entry that earlier versions of `aiwrap` created themselves.

## Commands

```bash
aiwrap install
aiwrap doctor
aiwrap doctor --verbose
aiwrap repair
aiwrap repair rtk
aiwrap repair mcp
aiwrap uninstall
```

After install, continue using your normal `codex` and `claude` commands.

## Hindsight Local Setup

`aiwrap` points detected clients at a **self-hosted [Vectorize Hindsight](https://hindsight.vectorize.io)** server over HTTP. It does not run or bundle a memory server itself — set the service up first (see `~/hindsight/README.md`), then:

```bash
aiwrap repair mcp
```

Connection details are read from `~/hindsight/.env`, overridable per-shell:

| Variable | Default | Meaning |
|---|---|---|
| `HINDSIGHT_URL` | `http://127.0.0.1:8888` | API base URL |
| `HINDSIGHT_BANK` | `pulkit` | bank the MCP endpoint is pinned to |
| `HINDSIGHT_TOKEN` | from `~/hindsight/.env` | tenant API key |

> **Name collision.** `hindsight-mcp` on npm is a *different* product
> ([hindsight-ai/hindsight-ai](https://github.com/hindsight-ai/hindsight-ai)). aiwrap ≤ 0.1.2
> vendored it and ran it over stdio. `aiwrap install` and `aiwrap repair mcp` now delete that
> binary and remove its client registration.

## Architecture

```text
codex / claude
      |
      +-- RTK configured by upstream init
      |
      +-- Hindsight MCP (streamable HTTP)
              |
              +-- http://127.0.0.1:8888/mcp/<bank>/
                      |
                      +-- self-hosted Hindsight (docker, ~/hindsight)
```

## Files

- `~/.ai-cli-wrapper/` stores managed binaries, config, logs, and backups.
- `~/.local/bin/aiwrap` symlinks to the managed binary.
- `~/.codex/config.toml` receives an `[mcp_servers.hindsight]` table written directly, because
  the Codex desktop app ships no CLI and, being a GUI app, cannot resolve
  `bearer_token_env_var` from your shell environment.
- Claude Code user MCP config receives a `hindsight` entry via `claude mcp add --scope user`.
- `~/hindsight/.env` is read for the API token. It is never written to.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `aiwrap: command not found` | `~/.local/bin` is not on `PATH` | Add `export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc` |
| RTK installed but no savings | RTK init not active or client not restarted | Run `aiwrap repair rtk`, restart Codex/Claude |
| Hindsight unavailable | MCP not registered or client not restarted | Run `aiwrap repair mcp`, restart Codex/Claude |
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
curl -fsS http://127.0.0.1:8888/health
```

Pass criteria:

- No package manager required for user install.
- No `sudo`.
- Codex and Claude are not installed by `aiwrap`.
- At least one detected client is configured.
- RTK is configured using upstream mechanisms.
- Hindsight Cloud tokens are not configured or stored by `aiwrap`.
- The obsolete `hindsight-mcp` binary and client entries are gone after install.
- Re-running install is safe and changes nothing.

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
- We do not configure Hindsight Cloud or store Hindsight API tokens.
- We do not overwrite unrelated MCP servers.
- The installer is designed to be safe to re-run.
- The uninstaller removes only wrapper-managed files and config entries.

## Roadmap

- Signed and notarized binaries.
- Optional support for more local CLI clients if they expose supported RTK/MCP integration surfaces.
