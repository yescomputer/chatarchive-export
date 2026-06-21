# Grok Platform

- Platform id: `grok`
- Registry config: [`../../platforms/grok.json`](../../platforms/grok.json)
- Display name: `Grok`
- Default enabled: yes

## URLs

- Start URL: `https://grok.com/`
- Canonical conversation URLs can appear as `/chat/<id>` or `/c/<id>` after navigation.

## DOM notes

Keep the tab active during DOM extraction. Grok page state can be sensitive to active-tab behavior during browser automation.

## QA notes

Markdown transcript exports should use the common `Assistant` label. The registry's `Grok` author alias remains for legacy QA compatibility.

## Troubleshooting

If duplicate messages or strange roles appear, inspect DOM selectors for nested assistant/user containers and re-test with a representative Grok fixture before re-exporting.
