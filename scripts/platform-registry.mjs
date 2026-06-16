import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLATFORM_DIR = path.resolve(__dirname, "../platforms");
const COMMON_AUTHOR_LABELS = ["You", "User", "Assistant"];
const LIST_FIELDS = [
  "authorAliases",
  "canonicalUrlPatterns",
  "startUrls",
  "enumerationNotes",
  "domNotes",
  "troubleshooting",
  "qaNotes"
];

function list(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function normalizePlatform(raw, filePath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Invalid platform config in ${filePath}: expected an object`);
  }
  if (!raw.id || typeof raw.id !== "string") {
    throw new Error(`Invalid platform config in ${filePath}: missing string id`);
  }
  if (!raw.displayName || typeof raw.displayName !== "string") {
    throw new Error(`Invalid platform config in ${filePath}: missing string displayName`);
  }

  const platform = {
    id: raw.id,
    displayName: raw.displayName,
    defaultEnabled: raw.defaultEnabled !== false
  };

  for (const field of LIST_FIELDS) {
    platform[field] = list(raw[field]);
  }

  return platform;
}

export function loadPlatformRegistry(options = {}) {
  const platformDir = path.resolve(options.platformDir || DEFAULT_PLATFORM_DIR);
  if (!fs.existsSync(platformDir)) {
    return [];
  }

  const platforms = fs.readdirSync(platformDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(platformDir, entry.name))
    .sort()
    .map((filePath) => normalizePlatform(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath));

  const seen = new Set();
  for (const platform of platforms) {
    if (seen.has(platform.id)) {
      throw new Error(`Duplicate platform id in registry: ${platform.id}`);
    }
    seen.add(platform.id);
  }

  return platforms;
}

export function getDefaultPlatformIds(registry = loadPlatformRegistry()) {
  return registry
    .filter((platform) => platform.defaultEnabled)
    .map((platform) => platform.id);
}

export function getKnownAuthorLabels(registry = loadPlatformRegistry()) {
  const labels = new Set(COMMON_AUTHOR_LABELS);
  for (const platform of registry) {
    for (const label of platform.authorAliases) {
      labels.add(label);
    }
  }
  return Array.from(labels);
}

export function getPlatformNotes(registry = loadPlatformRegistry()) {
  const notes = [];
  const seen = new Set();

  for (const platform of registry) {
    for (const note of [...platform.qaNotes, ...platform.enumerationNotes]) {
      const text = `${platform.displayName}: ${note}`;
      if (!seen.has(text)) {
        seen.add(text);
        notes.push(text);
      }
    }
  }

  return notes;
}

export function getAvailablePlatformIds(registry = loadPlatformRegistry()) {
  return registry.map((platform) => platform.id);
}
