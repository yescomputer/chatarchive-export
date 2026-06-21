import test from "node:test";
import assert from "node:assert/strict";
import { countMarkdownMessageHeadings } from "./audit-export.mjs";

test("counts example-style bold markdown transcript headings", () => {
  const markdown = [
    "# Example",
    "_Exported on 6/22/2026 at 00:15:44 GMT+08:00 from ChatGPT_",
    "",
    "---",
    "",
    "**User**",
    "",
    "Hello",
    "",
    "---",
    "",
    "**Assistant**",
    "",
    "Hi",
    "",
    "---"
  ].join("\n");

  assert.equal(countMarkdownMessageHeadings(markdown), 2);
});

test("still counts legacy platform markdown headings", () => {
  const markdown = [
    "### You",
    "Hello",
    "",
    "---",
    "",
    "### Gemini",
    "Hi",
    "",
    "---",
    "",
    "### NotAPlatform",
    "Ignored"
  ].join("\n");

  assert.equal(countMarkdownMessageHeadings(markdown), 2);
});
