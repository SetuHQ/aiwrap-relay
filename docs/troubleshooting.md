# Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `aiwrap: command not found` | `~/.local/bin` is not on `PATH` | Add `export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc` |
| RTK installed but no token savings | RTK init not active or the AI CLI session was not restarted | Run `aiwrap repair rtk`, then restart Codex/Claude |
| Hindsight tools unavailable | MCP not registered or client was already running | Run `aiwrap repair mcp`, then restart Codex/Claude |
| Hindsight registered but every call fails | The server is not running | `cd ~/hindsight && ./scripts/up.sh` |
| Hindsight calls return 401 | Token in the client config no longer matches the server | Run `aiwrap repair mcp` to rewrite it from `~/hindsight/.env` |
| Both `hindsight` and `hindsight-mcp` are listed | Upgraded from aiwrap ≤ 0.1.2 | Run `aiwrap repair mcp` — it removes the obsolete entry |
| macOS blocks a binary | Gatekeeper quarantine | Run `xattr -d com.apple.quarantine ~/.ai-cli-wrapper/bin/<binary>` |
| Duplicate Hindsight MCP server | Existing manual MCP config | Run `aiwrap doctor --verbose`, then choose whether to replace manually |

Run `aiwrap doctor --verbose` first. Every `warn`, `fix`, or `fail` line should include a next command.
