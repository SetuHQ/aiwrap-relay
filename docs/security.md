# Security

- Optional Hindsight Cloud tokens are stored in macOS Keychain under service `aiwrap.hindsight` and account `default`.
- Tokens are not written to `~/.codex/config.toml`, `~/.claude.json`, or `~/.ai-cli-wrapper/config.json`.
- The installer does not use `sudo`.
- The installer does not install Codex CLI or Claude Code.
- The installer writes managed files under `~/.ai-cli-wrapper` and symlinks launchers into `~/.local/bin`.
- Existing Codex and Claude configuration should be preserved. Prefer CLI registration over direct file mutation.
