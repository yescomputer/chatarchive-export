---
name: chatarchive-export
description: Export, resume, audit, and QA ChatArchive histories with Kimi WebBridge, logged-in browser sessions, and platform plugins. For Codex, Claude Code, Cursor, and similar agents.
---

# ChatArchive WebBridge Bulk Export

## Compatibility

This skill follows the Agent Skills pattern: a `chatarchive-export` directory with `SKILL.md` frontmatter (`name` and `description`) plus Markdown instructions. Use it with Codex, Claude Code, Cursor, and similar coding agents that can read `SKILL.md` and/or repository instructions such as `AGENTS.md`.

Keep the skill focused on ChatArchive WebBridge export, resume, audit, comparison, and QA workflows. Load detailed procedure and platform notes from `references/` when needed.

## Workflow

Use this skill from the ChatArchive repo root, normally `/Users/boyaxie/IdeaProjects/ChatArchive`.

Before browser work, use the `kimi-webbridge` skill if it is available. Read its `SKILL.md`, run:

```bash
~/.kimi-webbridge/bin/kimi-webbridge status
```

Proceed only when `running: true` and `extension_connected: true`. Use the user's logged-in browser session; do not export cookies, bypass login, or work around CAPTCHA/login controls.

For the full procedure, read [references/workflow.md](references/workflow.md) before running a live export or troubleshooting an export.

For platform-specific URL, enumeration, DOM, QA, and troubleshooting notes, read [references/platforms/README.md](references/platforms/README.md). Default platform IDs are the `defaultEnabled` entries in [platforms](platforms).

## Export Commands

Default full export:

```bash
node scripts/bulk-export-webbridge.js --platform <default-platform-ids> --format md,json --output exports/bulk-$(date +%F) --resume --account-label edge-default
```

Dry run before a new account or uncertain browser state:

```bash
node scripts/bulk-export-webbridge.js --platform <platform-id>[,<platform-id>] --format md,json --output exports/bulk-$(date +%F) --dry-run --limit 2 --account-label edge-default
```

Resume an interrupted run with the same output directory and account label. Use `--account-id` only when the user wants a stable explicit identity for the browser account.

## Output Contract

Expect this structure:

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

Treat `results.jsonl` as an append-only attempt log. Historical failed rows can remain after later retries succeed. Final status comes from each `summary.json` and, when present, `qa-report.json`.

## QA Helpers

Audit the local export:

```bash
node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/audit-export.mjs exports/bulk-YYYY-MM-DD --write-report
```

Sample original webpages through Kimi WebBridge:

```bash
node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/webpage-sample-check.mjs exports/bulk-YYYY-MM-DD --limit 1
```

Always close WebBridge sessions after manual checks. The helper closes its own sessions.

## Metadata Rules

Do not report uncertain UI or page-state model strings as confirmed model usage. If a page exposes model names in selectors, settings, feature flags, or state blobs, keep them as `model_candidates`, `modelCandidates`, or `modelHints` unless the page clearly attributes the exact conversation turn to that model.

Zero-message candidates are preserved because the platform UI or network exposed those URLs. Do not count them as message-bearing conversations.
