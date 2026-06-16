# Perplexity Platform

- Platform id: `perplexity`
- Registry config: [`../../platforms/perplexity.json`](../../platforms/perplexity.json)
- Display name: `Perplexity`
- Default enabled: yes

## URLs

- Start URL: `https://www.perplexity.ai/library`
- Canonical URL patterns: `https://www.perplexity.ai/search/<id>` and `https://www.perplexity.ai/library/<id>`

## Export notes

Enumerate from `https://www.perplexity.ai/library` for broad history coverage. The homepage and history views can expose only a small recent subset.

## QA notes

The audit report reads this platform's registry notes and should remind operators to use `/library` for broad coverage.

## Troubleshooting

If exports are too few, verify the start page is `/library` and rerun Perplexity with `--resume` against the same output directory.
