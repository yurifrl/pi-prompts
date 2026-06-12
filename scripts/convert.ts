#!/usr/bin/env bun
/**
 * convert.ts - Convert vendor/ files to fragments/skills/agents/prompts based on conversion-map.json
 *
 * Usage: bun run scripts/convert.ts
 */

import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";

const ROOT = dirname(dirname(import.meta.path));
const VENDOR_DIR = join(ROOT, "vendor", "system-prompts");
const CONVERSION_MAP_PATH = join(ROOT, "conversion-map.json");
const LOCK_PATH = join(ROOT, "upstream.lock.json");

const FRAGMENTS_DIR = join(ROOT, "fragments");
const SKILLS_DIR = join(ROOT, "skills");
const AGENTS_DIR = join(ROOT, "agents");
const PROMPTS_DIR = join(ROOT, "prompts");

interface ConversionMap {
  groups: Record<string, { description: string; files: string[] }>;
  skills: { include: string[] };
  agents: { include: string[] };
  prompts: { include: string[] };
  exclude: string[];
  triage: string[];
}

interface LockFile {
  commit: string | null;
  fetchedAt: string | null;
}

function loadConversionMap(): ConversionMap {
  return JSON.parse(readFileSync(CONVERSION_MAP_PATH, "utf-8"));
}

function saveConversionMap(map: ConversionMap): void {
  writeFileSync(CONVERSION_MAP_PATH, JSON.stringify(map, null, 2) + "\n");
}

function loadLock(): LockFile {
  if (!existsSync(LOCK_PATH)) return { commit: null, fetchedAt: null };
  return JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
}

function matchesPattern(filename: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return filename.startsWith(pattern.slice(0, -1));
  }
  return filename === pattern;
}

function isExcluded(filename: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((p) => matchesPattern(filename, p));
}

function extractTitle(content: string): string {
  // Try to find first heading
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();

  // Fallback: first non-empty line
  const lines = content.split("\n").filter((l) => l.trim());
  return lines[0]?.slice(0, 60) || "Untitled";
}

function toKebabCase(str: string): string {
  return str
    .replace(/^(system-prompt-|agent-prompt-|skill-)/i, "")
    .replace(/\.md$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function addFrontmatter(content: string, meta: Record<string, string>): string {
  // Strip existing frontmatter
  let body = content;
  if (body.startsWith("---")) {
    const endIdx = body.indexOf("---", 3);
    if (endIdx !== -1) {
      body = body.slice(endIdx + 3).trim();
    }
  }

  const fm = Object.entries(meta)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return `---\n${fm}\n---\n\n${body}`;
}

function clearDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

async function main() {
  console.log("🔧 pi-prompts convert\n");

  if (!existsSync(VENDOR_DIR)) {
    console.error("❌ vendor/system-prompts not found. Run sync.ts first.");
    process.exit(1);
  }

  const map = loadConversionMap();
  const lock = loadLock();
  const vendorFiles = readdirSync(VENDOR_DIR).filter((f) => f.endsWith(".md"));

  console.log(`📂 Found ${vendorFiles.length} files in vendor/\n`);

  // Track what's mapped
  const mappedFiles = new Set<string>();
  const triageNew: string[] = [];

  // Collect all explicitly mapped files
  for (const group of Object.values(map.groups)) {
    for (const f of group.files) mappedFiles.add(f);
  }
  for (const f of map.skills.include) mappedFiles.add(f);
  for (const f of map.agents.include) mappedFiles.add(f);
  for (const f of map.prompts.include) mappedFiles.add(f);

  // Clear output dirs
  clearDir(FRAGMENTS_DIR);
  for (const groupName of Object.keys(map.groups)) {
    mkdirSync(join(FRAGMENTS_DIR, groupName), { recursive: true });
  }
  clearDir(SKILLS_DIR);
  clearDir(AGENTS_DIR);
  clearDir(PROMPTS_DIR);

  let fragmentCount = 0;
  let skillCount = 0;
  let agentCount = 0;
  let promptCount = 0;

  // Process groups → fragments
  for (const [groupName, group] of Object.entries(map.groups)) {
    for (const filename of group.files) {
      const srcPath = join(VENDOR_DIR, filename);
      if (!existsSync(srcPath)) {
        console.warn(`   ⚠️  Missing: ${filename} (group: ${groupName})`);
        continue;
      }

      const content = readFileSync(srcPath, "utf-8");
      const outContent = addFrontmatter(content, {
        upstream_path: `system-prompts/${filename}`,
        upstream_commit: lock.commit || "unknown",
        converted_at: new Date().toISOString(),
        group: groupName,
      });

      const outPath = join(FRAGMENTS_DIR, groupName, filename);
      writeFileSync(outPath, outContent);
      fragmentCount++;
    }
  }
  console.log(`✅ Fragments: ${fragmentCount}`);

  // Process skills
  for (const filename of map.skills.include) {
    const srcPath = join(VENDOR_DIR, filename);
    if (!existsSync(srcPath)) {
      console.warn(`   ⚠️  Missing skill: ${filename}`);
      continue;
    }

    const content = readFileSync(srcPath, "utf-8");
    const skillName = toKebabCase(filename);
    const title = extractTitle(content);

    const skillDir = join(SKILLS_DIR, skillName);
    mkdirSync(skillDir, { recursive: true });

    const outContent = addFrontmatter(content, {
      name: skillName,
      description: title.slice(0, 100),
      upstream_path: `system-prompts/${filename}`,
      upstream_commit: lock.commit || "unknown",
    });

    writeFileSync(join(skillDir, "SKILL.md"), outContent);
    skillCount++;
  }
  console.log(`✅ Skills: ${skillCount}`);

  // Process agents
  for (const filename of map.agents.include) {
    const srcPath = join(VENDOR_DIR, filename);
    if (!existsSync(srcPath)) {
      console.warn(`   ⚠️  Missing agent: ${filename}`);
      continue;
    }

    const content = readFileSync(srcPath, "utf-8");
    const agentName = toKebabCase(filename);
    const title = extractTitle(content);

    const outContent = addFrontmatter(content, {
      name: agentName,
      description: title.slice(0, 100),
      upstream_path: `system-prompts/${filename}`,
      upstream_commit: lock.commit || "unknown",
    });

    writeFileSync(join(AGENTS_DIR, `${agentName}.md`), outContent);
    agentCount++;
  }
  console.log(`✅ Agents: ${agentCount}`);

  // Process prompts (slash commands)
  for (const filename of map.prompts.include) {
    const srcPath = join(VENDOR_DIR, filename);
    if (!existsSync(srcPath)) {
      console.warn(`   ⚠️  Missing prompt: ${filename}`);
      continue;
    }

    const content = readFileSync(srcPath, "utf-8");
    const promptName = toKebabCase(filename).replace(/-slash-command$/, "");
    const title = extractTitle(content);

    const outContent = addFrontmatter(content, {
      description: title.slice(0, 100),
      upstream_path: `system-prompts/${filename}`,
      upstream_commit: lock.commit || "unknown",
    });

    writeFileSync(join(PROMPTS_DIR, `${promptName}.md`), outContent);
    promptCount++;
  }
  console.log(`✅ Prompts: ${promptCount}`);

  // Find unmapped files → triage
  for (const filename of vendorFiles) {
    if (mappedFiles.has(filename)) continue;
    if (isExcluded(filename, map.exclude)) continue;
    if (map.triage.includes(filename)) continue;

    triageNew.push(filename);
  }

  if (triageNew.length > 0) {
    console.log(`\n⚠️  New unmapped files (${triageNew.length}) added to triage:`);
    for (const f of triageNew.slice(0, 15)) console.log(`   ${f}`);
    if (triageNew.length > 15) console.log(`   ... and ${triageNew.length - 15} more`);

    // Update triage list
    map.triage = [...new Set([...map.triage, ...triageNew])].sort();
    saveConversionMap(map);
    console.log("   → Updated conversion-map.json triage list");
  }

  console.log("\n✅ Conversion complete.");
}

main().catch((e) => {
  console.error("❌ Convert failed:", e);
  process.exit(1);
});
