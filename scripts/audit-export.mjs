#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { getKnownAuthorLabels, getPlatformNotes, loadPlatformRegistry } from "./platform-registry.mjs";

const PLATFORM_REGISTRY = loadPlatformRegistry();
const KNOWN_AUTHORS = new Set(getKnownAuthorLabels(PLATFORM_REGISTRY));
const PLATFORM_NOTES = getPlatformNotes(PLATFORM_REGISTRY);

function usage() {
  return `Usage:
  node audit-export.mjs <export-root> [--write-report]

Audits ChatArchive bulk export files and optionally writes qa-report.json.
`;
}

function parseArgs(argv) {
  const options = {
    root: "",
    writeReport: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--write-report") {
      options.writeReport = true;
    } else if (!options.root) {
      options.root = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
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

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs.readFileSync(filePath, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

function findPayload(summary, summaryFile, format, extension) {
  const summaryDir = path.dirname(summaryFile);
  const listed = summary.files?.find((file) => file.format === format)?.path;
  const listedPath = resolveListedPath(listed, summary.__root, summaryDir);
  if (listedPath && fs.existsSync(listedPath)) {
    return listedPath;
  }

  return fs.readdirSync(summaryDir)
    .map((name) => path.join(summaryDir, name))
    .find((filePath) => path.extname(filePath) === extension && path.basename(filePath) !== "summary.json") || listedPath;
}

function countMarkdownMessageHeadings(markdown) {
  return markdown
    .split(/\n/)
    .filter((line) => {
      const match = line.match(/^###\s+(.+?)\s*$/);
      return match && KNOWN_AUTHORS.has(match[1]);
    })
    .length;
}

function getMarkdownFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return "";
  }

  const end = markdown.indexOf("\n---", 4);
  return end === -1 ? "" : markdown.slice(4, end);
}

function hasAssertedModel(summary, jsonPayload, markdown) {
  const metadata = jsonPayload?.metadata || {};
  const extra = metadata.extra || {};
  const summaryData = summary.summary || {};
  const frontmatter = getMarkdownFrontmatter(markdown || "");
  return Boolean(
    metadata.model ||
    metadata.models ||
    extra.model ||
    extra.models ||
    summaryData.model ||
    summaryData.models ||
    /^models?:\s/m.test(frontmatter)
  );
}

function addPlatform(byPlatform, platform) {
  byPlatform[platform] ||= {
    total: 0,
    exported: 0,
    messageBearing: 0,
    zeroMessageCandidates: 0,
    jsonOk: 0,
    mdOk: 0,
    missing: 0
  };
  return byPlatform[platform];
}

function auditExport(root) {
  const absoluteRoot = path.resolve(root);
  const summaryFiles = walk(absoluteRoot, (filePath) => path.basename(filePath) === "summary.json");
  const allFiles = walk(absoluteRoot);
  const manifest = readJsonl(path.join(absoluteRoot, "manifest.jsonl"));
  const results = readJsonl(path.join(absoluteRoot, "results.jsonl"));
  const accountFiles = allFiles
    .filter((filePath) => path.basename(filePath) === "account.json")
    .map((filePath) => path.relative(absoluteRoot, filePath))
    .sort();

  const byPlatform = {};
  const issues = [];

  for (const summaryFile of summaryFiles) {
    const summary = readJson(summaryFile);
    summary.__root = absoluteRoot;
    const platform = summary.platform || "unknown";
    const stats = addPlatform(byPlatform, platform);
    stats.total += 1;
    if (summary.status === "exported") {
      stats.exported += 1;
    }

    const expectedCount = Number(summary.summary?.messageCount || 0);
    if (expectedCount > 0) {
      stats.messageBearing += 1;
    } else {
      stats.zeroMessageCandidates += 1;
    }

    const jsonPath = findPayload(summary, summaryFile, "json", ".json");
    const mdPath = findPayload(summary, summaryFile, "md", ".md");
    const missing = [];
    if (!jsonPath || !fs.existsSync(jsonPath)) {
      missing.push("json");
    }
    if (!mdPath || !fs.existsSync(mdPath)) {
      missing.push("md");
    }
    if (missing.length > 0) {
      stats.missing += missing.length;
      issues.push({ type: "missing-payload", platform, id: summary.id, missing, summaryFile });
      continue;
    }

    const jsonPayload = readJson(jsonPath);
    const markdown = fs.readFileSync(mdPath, "utf8");
    const jsonCount = Array.isArray(jsonPayload.messages) ? jsonPayload.messages.length : 0;
    const mdCount = countMarkdownMessageHeadings(markdown);

    if (jsonCount === expectedCount) {
      stats.jsonOk += 1;
    } else {
      issues.push({ type: "json-count", platform, id: summary.id, expected: expectedCount, actual: jsonCount, jsonPath });
    }

    if (mdCount === expectedCount) {
      stats.mdOk += 1;
    } else {
      issues.push({ type: "md-count", platform, id: summary.id, expected: expectedCount, actual: mdCount, mdPath });
    }

    if (hasAssertedModel(summary, jsonPayload, markdown)) {
      issues.push({ type: "asserted-model", platform, id: summary.id, summaryFile });
    }
  }

  const bytes = allFiles.reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
  return {
    generatedAt: new Date().toISOString(),
    outputRoot: absoluteRoot,
    totals: {
      manifestCandidates: manifest.length,
      finalSummaryFiles: summaryFiles.length,
      files: allFiles.length,
      bytes,
      resultLogRows: results.length,
      resultLogExportedRows: results.filter((row) => row.status === "exported").length,
      historicalFailedAttemptRows: results.filter((row) => row.status === "failed").length
    },
    byPlatform,
    accountFiles,
    consistency: {
      summaryJsonMarkdownMessageCountsMatch: issues.every((issue) => !["json-count", "md-count"].includes(issue.type)),
      missingPayloadFiles: issues.filter((issue) => issue.type === "missing-payload").length,
      assertedModelFieldsRemoved: issues.every((issue) => issue.type !== "asserted-model"),
      modelMetadataPolicy: "Unconfirmed model strings should be stored as modelCandidates/modelHints instead of asserted model/models."
    },
    issueCount: issues.length,
    issues,
    notes: [
      "results.jsonl is append-only and may contain historical failed attempts that later succeeded; final status should be read from per-conversation summary.json files and this report.",
      "Zero-message candidates are preserved because the platform UI/network exposed those URLs, but they should not be counted as message-bearing conversations.",
      ...PLATFORM_NOTES
    ]
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.root) {
    process.stdout.write(usage());
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const report = auditExport(options.root);
  if (options.writeReport) {
    const reportPath = path.join(report.outputRoot, "qa-report.json");
    let previous = null;
    if (fs.existsSync(reportPath)) {
      try {
        previous = readJson(reportPath);
      } catch {}
    }
    if (Array.isArray(previous?.webpageSamples) && !report.webpageSamples) {
      report.webpageSamples = previous.webpageSamples;
    }
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.issueCount > 0) {
    process.exitCode = 1;
  }
}

main();
