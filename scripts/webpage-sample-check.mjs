#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_WEBBRIDGE_URL = "http://127.0.0.1:10086";

function usage() {
  return `Usage:
  node webpage-sample-check.mjs <export-root> [--platform chatgpt,grok] [--limit N] [--webbridge-url URL] [--dry-run-plan]

Samples exported conversations and checks first/last message snippets against the current original webpage text through Kimi WebBridge.
`;
}

function parseArgs(argv) {
  const options = {
    root: "",
    platforms: [],
    limit: 1,
    webbridgeUrl: DEFAULT_WEBBRIDGE_URL,
    dryRunPlan: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--platform") {
      options.platforms = String(argv[++index] || "").split(",").map((value) => value.trim()).filter(Boolean);
    } else if (arg.startsWith("--platform=")) {
      options.platforms = arg.slice("--platform=".length).split(",").map((value) => value.trim()).filter(Boolean);
    } else if (arg === "--limit") {
      options.limit = Number(argv[++index] || "1");
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else if (arg === "--webbridge-url") {
      options.webbridgeUrl = String(argv[++index] || DEFAULT_WEBBRIDGE_URL);
    } else if (arg.startsWith("--webbridge-url=")) {
      options.webbridgeUrl = arg.slice("--webbridge-url=".length);
    } else if (arg === "--dry-run-plan") {
      options.dryRunPlan = true;
    } else if (!options.root) {
      options.root = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 1) {
    options.limit = 1;
  }

  return options;
}

function walk(dir, predicate = () => true, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(filePath, predicate, files);
    } else if (predicate(filePath)) {
      files.push(filePath);
    }
  }

  return files;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveListedPath(listedPath, root, summaryDir) {
  if (!listedPath) {
    return "";
  }

  const candidates = path.isAbsolute(listedPath)
    ? [listedPath]
    : [
        path.resolve(process.cwd(), listedPath),
        path.resolve(root, listedPath),
        path.resolve(summaryDir, listedPath)
      ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function findJsonPayload(summary, summaryFile, root) {
  const summaryDir = path.dirname(summaryFile);
  const listed = summary.files?.find((file) => file.format === "json")?.path;
  const listedPath = resolveListedPath(listed, root, summaryDir);
  if (listedPath && fs.existsSync(listedPath)) {
    return listedPath;
  }

  return fs.readdirSync(summaryDir)
    .map((name) => path.join(summaryDir, name))
    .find((filePath) => path.extname(filePath) === ".json" && path.basename(filePath) !== "summary.json") || "";
}

function cleanText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, "")
    .trim();
}

function snippet(value, maxLength = 42) {
  return cleanText(value).replace(/https?:\/\/[^\s]+/g, "").slice(0, maxLength);
}

function selectSamples(root, options) {
  const summaryFiles = walk(root, (filePath) => path.basename(filePath) === "summary.json");
  const byPlatform = new Map();

  for (const summaryFile of summaryFiles) {
    const summary = readJson(summaryFile);
    const platform = summary.platform || "unknown";
    if (options.platforms.length > 0 && !options.platforms.includes(platform)) {
      continue;
    }
    if (Number(summary.summary?.messageCount || 0) <= 0) {
      continue;
    }
    const jsonPath = findJsonPayload(summary, summaryFile, root);
    if (!jsonPath || !fs.existsSync(jsonPath)) {
      continue;
    }
    const payload = readJson(jsonPath);
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    if (messages.length === 0) {
      continue;
    }
    const sample = {
      platform,
      id: summary.id,
      title: payload.metadata?.title || summary.title || "",
      url: payload.metadata?.source || summary.url,
      messageCount: messages.length,
      jsonPath,
      messages
    };
    byPlatform.set(platform, [...(byPlatform.get(platform) || []), sample]);
  }

  return Array.from(byPlatform.keys()).sort().flatMap((platform) => {
    return byPlatform.get(platform).slice(0, options.limit);
  });
}

async function command(webbridgeUrl, session, action, args = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${webbridgeUrl.replace(/\/$/, "")}/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session, action, args }),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${text.slice(0, 300)}`);
    }
    const data = JSON.parse(text);
    if (data?.ok && data.data) {
      return unwrap(data.data);
    }
    return unwrap(data);
  } finally {
    clearTimeout(timeout);
  }
}

function unwrap(data) {
  if (data && Object.prototype.hasOwnProperty.call(data, "value")) {
    return data.value;
  }
  return data;
}

async function checkSample(sample, options) {
  const session = `chatarchive-qa-${sample.platform}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await command(options.webbridgeUrl, session, "navigate", {
      url: sample.url,
      newTab: true,
      group_title: `QA ${sample.platform}`
    }, 120000);

    const selectedMessages = [sample.messages[0], sample.messages[sample.messages.length - 1]].filter(Boolean);
    let page = { url: sample.url, title: "", text: "" };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 4500 : 1500));
      page = await command(options.webbridgeUrl, session, "evaluate", {
        code: "(() => ({ url: location.href, title: document.title, text: document.body ? document.body.innerText : '' }))()"
      }, 90000);
      const pageNorm = cleanText(page.text || "");
      const required = selectedMessages.map((message) => snippet(message.content, 34)).filter(Boolean);
      if (required.length > 0 && required.every((part) => pageNorm.includes(part))) {
        break;
      }
    }

    const pageNorm = cleanText(page.text || "");
    const checks = selectedMessages.map((message) => {
      const part = snippet(message.content, 34);
      return {
        author: message.author,
        snippet: part,
        found: part ? pageNorm.includes(part) : false
      };
    });

    return {
      platform: sample.platform,
      id: sample.id,
      title: sample.title,
      url: page.url || sample.url,
      messageCount: sample.messageCount,
      checks,
      ok: checks.every((check) => check.found)
    };
  } catch (error) {
    return {
      platform: sample.platform,
      id: sample.id,
      title: sample.title,
      url: sample.url,
      messageCount: sample.messageCount,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    try {
      await command(options.webbridgeUrl, session, "close_session", {}, 20000);
    } catch {}
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.root) {
    process.stdout.write(usage());
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const root = path.resolve(options.root);
  const samples = selectSamples(root, options);
  if (options.dryRunPlan) {
    process.stdout.write(`${JSON.stringify({
      dryRunPlan: true,
      outputRoot: root,
      sampleCount: samples.length,
      samples: samples.map(({ platform, id, title, url, messageCount }) => ({ platform, id, title, url, messageCount }))
    }, null, 2)}\n`);
    return;
  }

  const results = [];
  for (const sample of samples) {
    results.push(await checkSample(sample, options));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    outputRoot: root,
    sampleCount: results.length,
    passCount: results.filter((result) => result.ok).length,
    failCount: results.filter((result) => !result.ok).length,
    webpageSamples: results
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
