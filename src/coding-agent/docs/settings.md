# Settings and Environment

Settings select the default provider/model and locate local configuration and sessions. Loop currently supports a small configuration surface, not Pi's full settings schema.

## Settings file

The agent directory defaults to `~/.loop`. `LOOP_DATA_DIR` changes that directory; SDK callers can pass `agentDir`. Its optional `settings.json` contains exactly these supported fields:

```json
{
  "provider": "openai",
  "model": "gpt-5.5"
}
```

Both fields must be strings; unknown fields reject. No file means built-in defaults. `SettingsManager.create(agentDir?)` loads it; `SettingsManager.inMemory({ provider, id })` supplies defaults without a settings file. There is no settings writer or project-level settings merge.

## Environment reference

| Variable | Use |
| --- | --- |
| `LOOP_AI_PROVIDER` | Provider selection, default `openai`. |
| `LOOP_MODEL` | Model selection, default `gpt-5.5`. |
| `LOOP_AI_BASE_URL` | Optional compatible endpoint override. |
| `LOOP_AI_API_KEY` | Explicit API-key override for the configured provider. |
| `OPENAI_API_KEY` | Pi AI's native OpenAI credential source when no override is used. |
| `LOOP_DATA_DIR` | Configuration and default session-storage root. |

Other provider credential sources are resolved by Pi AI. The standalone Agent sample uses its own `AGENT_MAESTRO_API_KEY`; coding-agent samples use the `LOOP_*` variables above.

Use exported variables in a terminal or local `.env` assignments. Bun loads `.env` automatically. The repository's [.env.example](../../../.env.example) contains placeholders only.

## Precedence and storage

CLI flags take priority over environment and settings for new-session model selection. Resuming preserves the saved identity unless explicitly overridden; see [models](models.md#defaults) for CLI/SDK differences.

Session files default to `<agentDir>/sessions/<workspace-hash>/<id>.jsonl`. The hash groups sessions by canonical cwd. `--session-dir` or an explicit `SessionManager` directory overrides storage without changing the settings directory.

Loop records provider/model identity, not endpoint or authentication configuration, in session metadata. Conversation content and tool output can still contain sensitive data; session files are local runtime data and should not be committed.

## Source

[config.ts](../config.ts), [settings-manager.ts](../core/settings-manager.ts), [settings-manager.test.ts](../core/settings-manager.test.ts), and [models](models.md).
