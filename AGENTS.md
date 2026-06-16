# Agent Instructions

This repository contains the `chatarchive-export` Agent Skill for exporting and QA-checking ChatArchive chatbot archives through Kimi WebBridge.

## Entry points

- Read `SKILL.md` first when the user asks to export, resume, audit, or compare chatbot histories.
- Read `references/workflow.md` before live exports or troubleshooting.
- Read `references/platforms/README.md` and the relevant `references/platforms/<platform-id>.md` file for platform-specific URLs, enumeration, DOM, QA, and troubleshooting notes.
- `agents/openai.yaml` is display metadata for OpenAI/Codex-compatible skill catalogs.

## Runtime expectations

- Run ChatArchive export commands from the ChatArchive repository root, normally `/Users/boyaxie/IdeaProjects/ChatArchive`, not from this skill directory.
- Confirm `scripts/bulk-export-webbridge.js` exists in the ChatArchive repository before running export commands.
- Before browser work, run `~/.kimi-webbridge/bin/kimi-webbridge status` and continue only when `running: true` and `extension_connected: true`.
- Use the user's already-logged-in browser sessions through Kimi WebBridge.

## Safety boundaries

- Do not export cookies or credentials.
- Do not bypass login, CAPTCHA, rate limits, or other access controls.
- Do not automatically enter credentials. If a platform is not logged in, report that authentication is required and wait for the user to take over.
- Do not report uncertain UI or state-payload model names as confirmed model usage. Store weak evidence as `model_candidates`, `modelCandidates`, or `modelHints`.

## Output interpretation

- Treat `results.jsonl` as an append-only attempt log; historical failed rows can remain after successful retries.
- Use each conversation's `summary.json` and, when present, `qa-report.json` for final status and counts.
- Preserve zero-message candidates for coverage tracking, but do not count them as message-bearing conversations. Use `summary.summary.messageCount > 0` for message-bearing counts.

## When editing this skill

- Keep the skill directory name and `SKILL.md` frontmatter `name` aligned as `chatarchive-export`.
- Keep the `SKILL.md` `description` concise and trigger-oriented so Claude Code, Codex, Cursor, and similar agents can discover it reliably.
- Keep long platform-specific details in `references/` instead of expanding `SKILL.md` unnecessarily.
