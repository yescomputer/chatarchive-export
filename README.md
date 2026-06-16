# ChatArchive WebBridge Bulk Export

[简体中文](README.zh-CN.md)

ChatArchive WebBridge Bulk Export is an Agent Skill for bulk exporting and QA-checking AI chatbot conversation archives from the ChatArchive project. It uses Kimi WebBridge, the user's already-logged-in browser sessions, and registered platform plugins to produce Markdown, JSON, and QA reports.

## Use cases

- Bulk export conversation history from multiple AI chatbot platforms.
- Resume interrupted exports using the same output directory.
- Audit exported Markdown and JSON files for consistency.
- Sample original webpages and compare the first and last message snippets against exported content.
- Organize archives by account, platform, and conversation ID to avoid conflicts during multi-account exports.

## Agent compatibility

This repository is structured for Codex, Claude Code, Cursor, and other agent-capable coding environments.

- `SKILL.md` is the primary Agent Skills entrypoint. Its frontmatter includes `name` and `description`, and the skill directory name is `chatarchive-export`.
- `AGENTS.md` provides repository-level instructions for Codex, Cursor, and compatible agents that read agent guidance before working.
- `agents/openai.yaml` keeps the OpenAI/Codex display metadata.
- Reference material lives in `references/` so agents can load detailed workflow and platform notes only when needed.

Actual execution still depends on the host agent being able to read local files, run local commands, and access Kimi WebBridge in the user's environment.

## Project layout

```text
.
├── SKILL.md                         # Agent Skills entrypoint
├── AGENTS.md                        # Repository-level agent instructions
├── agents/openai.yaml               # OpenAI/Codex display metadata
├── platforms/*.json                 # Platform plugin metadata and QA notes
├── references/workflow.md           # General export workflow and troubleshooting
├── references/platforms/*.md        # Platform-specific URLs, enumeration, DOM, and troubleshooting notes
└── scripts/
    ├── platform-registry.mjs        # Platform registry reader and validator
    ├── audit-export.mjs             # Local export audit helper
    └── webpage-sample-check.mjs     # Kimi WebBridge webpage sampling helper
```

## Prerequisites

1. Run export commands from the ChatArchive repository root, normally:

   ```bash
   /Users/boyaxie/IdeaProjects/ChatArchive
   ```

2. Confirm the ChatArchive export script exists:

   ```bash
   test -f scripts/bulk-export-webbridge.js
   ```

3. Confirm Kimi WebBridge is running and the browser extension is connected:

   ```bash
   ~/.kimi-webbridge/bin/kimi-webbridge status
   ```

   Continue only when `running: true` and `extension_connected: true`.

4. The user must already be logged in to target platforms in the browser profile controlled by WebBridge. This skill does not export cookies, bypass login, bypass CAPTCHA, or work around authentication controls.

5. If ChatArchive code was modified before an export, run:

   ```bash
   npm test
   ```

## Quick start

### Full export

Run from the ChatArchive repository root:

```bash
node scripts/bulk-export-webbridge.js \
  --platform <default-platform-ids> \
  --format md,json \
  --output exports/bulk-$(date +%F) \
  --resume \
  --account-label edge-default
```

`<default-platform-ids>` is the comma-separated list of platform IDs whose `platforms/*.json` files have `defaultEnabled` set to `true`.

### Dry run for a new account or uncertain browser state

```bash
node scripts/bulk-export-webbridge.js \
  --platform <platform-id>[,<platform-id>] \
  --format md,json \
  --output exports/bulk-$(date +%F) \
  --dry-run \
  --limit 2 \
  --account-label edge-default
```

### Resume an interrupted export

Use the same output directory and account label:

```bash
node scripts/bulk-export-webbridge.js \
  --platform <platform-id> \
  --format md,json \
  --output exports/bulk-YYYY-MM-DD \
  --resume \
  --account-label edge-default
```

### Multi-account exports

For multi-account workflows, use stable account labels and account IDs:

```bash
node scripts/bulk-export-webbridge.js \
  --platform <platform-id> \
  --format md,json \
  --output exports/bulk-YYYY-MM-DD \
  --resume \
  --account-label work \
  --account-id <stable-account-id>
```

## Output contract

Export output is organized by account, platform, and conversation ID:

```text
exports/bulk-YYYY-MM-DD/
├── manifest.jsonl
├── results.jsonl
├── qa-report.json
└── accounts/<account-slug>/<platform>/<conversation-id>/
    ├── summary.json
    ├── *.md
    └── *.json
```

Important files:

- `manifest.jsonl`: candidate conversation list.
- `results.jsonl`: append-only attempt log. Historical failures can remain after later retries succeed.
- `summary.json`: final per-conversation status. Prefer this file for final export statistics.
- `qa-report.json`: local audit and webpage sampling report.

Do not derive final success counts from `results.jsonl` alone. Use each `summary.json` and, when present, `qa-report.json`.

## QA helpers

### Audit local export files

```bash
node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/audit-export.mjs \
  exports/bulk-YYYY-MM-DD \
  --write-report
```

The audit checks:

- Whether `summary.json`, Markdown, and JSON message counts agree.
- Whether Markdown or JSON payload files are missing.
- Whether unconfirmed `model` or `models` assertion fields are still present.
- Per-platform export counts, message-bearing conversation counts, and zero-message candidate counts.

### Sample original webpages

```bash
node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/webpage-sample-check.mjs \
  exports/bulk-YYYY-MM-DD \
  --limit 1
```

The helper opens exported conversation webpages through Kimi WebBridge and checks whether the first and last message snippets can be found in the page body. It closes the WebBridge sessions it creates.

To preview the sampling plan without opening webpages:

```bash
node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/webpage-sample-check.mjs \
  exports/bulk-YYYY-MM-DD \
  --limit 1 \
  --dry-run-plan
```

## Platform plugins and notes

Platform knowledge is split into two layers:

- `platforms/*.json`: executable metadata, including platform ID, default enablement, author aliases, URL patterns, start pages, and QA notes.
- `references/platforms/*.md`: operator-facing platform notes, including URLs, enumeration entrypoints, DOM details, and platform-specific troubleshooting.

When adding a new platform, first add `platforms/<platform-id>.json` and `references/platforms/<platform-id>.md`, then confirm the external ChatArchive exporter supports the same `--platform` ID.

## Metadata policy

Do not treat weak page evidence as confirmed model usage. Model names exposed in selectors, settings, feature flags, state payloads, or UI labels can be candidates or defaults rather than the model used for a specific conversation turn.

- Store unconfirmed model information as `model_candidates`, `modelCandidates`, or `modelHints`.
- Write deterministic `model` or `models` fields only when the page clearly attributes a model to a specific conversation or message.

## Zero-message candidates

Zero-message candidates are URLs exposed by platform UI or network data where no message content was extracted. Preserve them for coverage tracking, but do not count them as message-bearing conversations. Use `summary.summary.messageCount > 0` to identify message-bearing conversations.

## Troubleshooting

- If WebBridge commands time out, increase the timeout, for example `--command-timeout-ms 120000`, and resume with the same output directory.
- For platform-specific enumeration or DOM issues, read `references/platforms/<platform-id>.md` and `platforms/<platform-id>.json` first.
- If `results.jsonl` contains failure rows but all `summary.json` files show `exported`, the failure rows are usually historical attempt records.
- If a platform is not logged in, mark it as requiring authentication and skip it unless the user explicitly takes over login. Do not enter credentials automatically.

## Related documentation

- [Skill entrypoint](SKILL.md)
- [Agent instructions](AGENTS.md)
- [Full workflow](references/workflow.md)
- [Platform plugin index](references/platforms/README.md)

## License

MIT. See [LICENSE](LICENSE).
