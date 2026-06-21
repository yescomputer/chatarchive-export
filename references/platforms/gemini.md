# Gemini Platform

- Platform id: `gemini`
- Registry config: [`../../platforms/gemini.json`](../../platforms/gemini.json)
- Display name: `Gemini`
- Default enabled: yes

## URLs

- Start URL: `https://gemini.google.com/app`
- Canonical conversation URL: `https://gemini.google.com/app/<id>`
- Some gem URLs may also be exposed by the UI.

## Export notes

Treat UI-exposed gem URLs as platform-specific conversation sources when the external ChatArchive exporter surfaces them.

## QA notes

Markdown transcript exports should use the common `Assistant` label. The registry's `Gemini` author alias remains for legacy QA compatibility.
