# Platform Registry

Platform-specific export knowledge is split out of the core workflow and stored as registry metadata plus per-platform notes.

## Registry files

The executable registry data lives in [`../../platforms`](../../platforms):

- [`chatgpt.json`](../../platforms/chatgpt.json)
- [`gemini.json`](../../platforms/gemini.json)
- [`claude.json`](../../platforms/claude.json)
- [`deepseek.json`](../../platforms/deepseek.json)
- [`perplexity.json`](../../platforms/perplexity.json)
- [`grok.json`](../../platforms/grok.json)

Each platform config should include:

- `id`: CLI platform id.
- `displayName`: Human readable platform name.
- `defaultEnabled`: Whether the platform belongs to the default export set.
- `authorAliases`: Markdown message heading labels used by QA.
- `canonicalUrlPatterns`: Expected conversation URL shapes.
- `startUrls`: Recommended starting pages for enumeration.
- `enumerationNotes`, `domNotes`, `troubleshooting`, `qaNotes`: Platform-specific guidance consumed by docs and QA reports.

## Platform notes

- [ChatGPT](chatgpt.md)
- [Gemini](gemini.md)
- [Claude](claude.md)
- [DeepSeek](deepseek.md)
- [Perplexity](perplexity.md)
- [Grok](grok.md)

## Adding a platform

1. Add a new `platforms/<id>.json` file using the same schema.
2. Add `references/platforms/<id>.md` with URL, enumeration, QA, and troubleshooting notes.
3. Confirm the external ChatArchive exporter supports the same platform id before running a live export.
4. Run `node scripts/audit-export.mjs --help` and `node scripts/webpage-sample-check.mjs --help` to verify registry loading still works.

This skill registry does not implement the real DOM exporter. The actual export implementation still lives in the ChatArchive repository's `scripts/bulk-export-webbridge.js` until that repository is separately adapterized.
