# ChatArchive WebBridge Bulk Export Workflow

## Preflight

1. Confirm the working directory is the ChatArchive repo root, usually `/Users/boyaxie/IdeaProjects/ChatArchive`.
2. Check the bulk exporter exists:
   ```bash
   test -f scripts/bulk-export-webbridge.js
   ```
3. Check Node dependencies and tests when the repo changed:
   ```bash
   npm test
   ```
4. Read and follow the `kimi-webbridge` skill before browser automation.
5. Run:
   ```bash
   ~/.kimi-webbridge/bin/kimi-webbridge status
   ```
   Continue only when both daemon and browser extension are connected.
6. Confirm the user has already logged into the requested platforms in the browser profile controlled by Kimi WebBridge.
7. Inspect `git status --short` before editing ChatArchive code. Do not revert unrelated user changes.

## Export Patterns

Use all `defaultEnabled` platform IDs from this skill's `platforms/*.json` registry unless the user narrows scope. Pass the comma-joined IDs to the external ChatArchive exporter:

```bash
node scripts/bulk-export-webbridge.js --platform <default-platform-ids> --format md,json --output exports/bulk-$(date +%F) --resume --account-label edge-default
```

Use a dry run for a new browser/account state:

```bash
node scripts/bulk-export-webbridge.js --platform <platform-id>[,<platform-id>] --format md,json --output exports/bulk-$(date +%F) --dry-run --limit 2 --account-label edge-default
```

Resume with the same output directory:

```bash
node scripts/bulk-export-webbridge.js --platform <platform-id> --format md,json --output exports/bulk-YYYY-MM-DD --resume --account-label edge-default
```

For multi-account exports, keep account labels stable and explicit:

```bash
node scripts/bulk-export-webbridge.js --platform <platform-id> --format md,json --output exports/bulk-YYYY-MM-DD --resume --account-label work --account-id <stable-account-id>
```

The exporter should create `accounts/<account-slug>/<platform>/<conversation-id>/`. Do not flatten account directories; they prevent collisions when the same platform is exported from multiple accounts.

## Platform Notes

Platform-specific URL patterns, start pages, DOM behavior, QA notes, and troubleshooting now live in [platforms](../platforms) and [references/platforms](platforms/README.md). Read the target platform note before a live export, especially for platforms with custom enumeration or active-tab behavior.

## QA Procedure

1. Audit local files:
   ```bash
   node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/audit-export.mjs exports/bulk-YYYY-MM-DD --write-report
   ```
2. Compare sampled original webpages:
   ```bash
   node /Users/boyaxie/.agents/skills/chatarchive-export/scripts/webpage-sample-check.mjs exports/bulk-YYYY-MM-DD --limit 1
   ```
3. If the webpage sample passes, update or preserve `qa-report.json`.
4. Report final counts from `summary.json` files and `qa-report.json`, not raw `results.jsonl`.

## Interpreting Results

- `manifest.jsonl` is the candidate list.
- `results.jsonl` is append-only. Failed attempts can remain after a successful resume.
- `summary.json` is the per-conversation final status.
- Message-bearing conversations have `summary.messageCount > 0`.
- Zero-message candidates are exposed URLs without extracted messages; keep them visible but do not count them as conversations with content.

## Metadata Policy

Do not assert model usage from weak page evidence. UI labels, feature flags, model selector values, and state payloads often list candidate models or defaults unrelated to the exact conversation. Store uncertain values as `model_candidates`, `modelCandidates`, or `modelHints`; remove asserted `model` or `models` fields unless the exact conversation model is clearly attributable.

## Troubleshooting

- If WebBridge commands time out, retry with `--command-timeout-ms 120000` or higher and resume the same output directory.
- For platform-specific enumeration or DOM issues, read the matching file in `references/platforms/` and the registry notes in `platforms/<platform-id>.json`.
- If `results.jsonl` shows failures but every `summary.json` is exported, treat those failures as historical attempts.
- If a platform is logged out, mark it as authentication required and skip; do not automate credential entry unless the user explicitly takes over login.
