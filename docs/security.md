# Security

## Credentials

- `aiwrap` does not configure Hindsight Cloud and never prompts for or stores a cloud token.
- The **local** Hindsight tenant token is read from `~/hindsight/.env` (or `$HINDSIGHT_TOKEN`).
  `aiwrap` only reads that file; it never writes to it.
- That token **is** written, in plaintext, into `~/.codex/config.toml` as an
  `http_headers = { Authorization = "Bearer …" }` value, and passed to
  `claude mcp add --header`.

  `~/.codex/config.toml` is written `0600` and then explicitly `chmod`ed to
  `0600`. The chmod is not redundant: Node applies `writeFile`'s `mode` option
  only when it *creates* the file, so rewriting an existing `0644` config would
  otherwise leave the token group- and world-readable. `aiwrap` cannot control
  the permissions of Claude Code's own `~/.claude.json`.

  This is a deliberate trade-off. Codex's `bearer_token_env_var` reads from the process
  environment, and the Codex desktop app is a macOS GUI application that does not inherit
  your shell environment — so an env-var reference would silently never resolve.

  The exposure is bounded: the token only grants access to a service published on
  `127.0.0.1`, and rotating it is `HINDSIGHT_API_TENANT_API_KEY` in `~/hindsight/.env`
  → `docker compose restart hindsight` → `aiwrap repair mcp`.

- No AWS credentials pass through `aiwrap`. Bedrock is reached by the Hindsight container
  using the keys in `~/hindsight/.env`.

## Install behaviour

- The installer does not use `sudo`.
- The installer does not install Codex CLI or Claude Code.
- The installer writes managed files under `~/.ai-cli-wrapper` and symlinks launchers into
  `~/.local/bin`.

## Config mutation

- Existing Codex and Claude configuration is preserved. CLI registration is preferred where a
  CLI exists (Claude Code); `~/.codex/config.toml` is edited directly because the Codex
  desktop app ships no CLI on `PATH`.
- Direct edits are line-anchored to a single `[mcp_servers.*]` table, are idempotent, and
  leave every other table untouched.
- The only entry `aiwrap` removes that it did not just write is `hindsight-mcp` — the
  obsolete stdio registration that earlier versions of `aiwrap` created themselves.
