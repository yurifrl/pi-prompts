#!/usr/bin/env bun
/**
 * sync.ts - Fetch upstream Piebald repo, snapshot to vendor/, update lock, report diff
 *
 * Usage: bun run scripts/sync.ts
 */

import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";

const ROOT = dirname(dirname(import.meta.path));
const VENDOR_DIR = join(ROOT, "vendor");
const LOCK_PATH = join(ROOT, "upstream.lock.json");
const UPSTREAM_REPO = "https://github.com/Piebald-AI/claude-code-system-prompts.git";
const TEMP_DIR = join(ROOT, ".tmp-upstream");

interface LockFile {
  repo: string;
  commit: string | null;
  fetchedAt: string | null;
  files: Record<string, string>; // path -> sha256
}

function loadLock(): LockFile {
  if (!existsSync(LOCK_PATH)) {
    return { repo: UPSTREAM_REPO, commit: null, fetchedAt: null, files: {} };
  }
  return JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
}

function saveLock(lock: LockFile): void {
  writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n");
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function getAllFiles(dir: string, base = ""): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...getAllFiles(join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".md")) {
      results.push(relPath);
    }
  }
  return results;
}

function copyDir(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      const content = readFileSync(srcPath);
      writeFileSync(destPath, content);
    }
  }
}

async function main() {
  console.log("🔄 pi-prompts sync\n");

  const oldLock = loadLock();

  // Clone shallow to temp
  console.log("📥 Fetching upstream...");
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }

  try {
    execSync(`git clone --depth 1 ${UPSTREAM_REPO} ${TEMP_DIR}`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e: any) {
    console.error("❌ Failed to clone upstream:", e.message);
    process.exit(1);
  }

  // Get commit hash
  const commit = execSync("git rev-parse HEAD", { cwd: TEMP_DIR, encoding: "utf-8" }).trim();
  console.log(`📌 Commit: ${commit}`);

  // Compute new file hashes
  const systemPromptsDir = join(TEMP_DIR, "system-prompts");
  const newFiles: Record<string, string> = {};

  if (existsSync(systemPromptsDir)) {
    for (const file of getAllFiles(systemPromptsDir)) {
      const content = readFileSync(join(systemPromptsDir, file), "utf-8");
      newFiles[`system-prompts/${file}`] = sha256(content);
    }
  }

  // Diff report
  const oldFiles = oldLock.files;
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const [path, hash] of Object.entries(newFiles)) {
    if (!(path in oldFiles)) {
      added.push(path);
    } else if (oldFiles[path] !== hash) {
      changed.push(path);
    }
  }

  for (const path of Object.keys(oldFiles)) {
    if (!(path in newFiles)) {
      removed.push(path);
    }
  }

  // Report
  console.log("\n📊 Diff Report:");
  if (added.length === 0 && changed.length === 0 && removed.length === 0) {
    console.log("   No changes from last sync.");
  } else {
    if (added.length > 0) {
      console.log(`\n   ➕ Added (${added.length}):`);
      for (const f of added.slice(0, 20)) console.log(`      ${f}`);
      if (added.length > 20) console.log(`      ... and ${added.length - 20} more`);
    }
    if (changed.length > 0) {
      console.log(`\n   ✏️  Changed (${changed.length}):`);
      for (const f of changed.slice(0, 20)) console.log(`      ${f}`);
      if (changed.length > 20) console.log(`      ... and ${changed.length - 20} more`);
    }
    if (removed.length > 0) {
      console.log(`\n   ➖ Removed (${removed.length}):`);
      for (const f of removed.slice(0, 20)) console.log(`      ${f}`);
      if (removed.length > 20) console.log(`      ... and ${removed.length - 20} more`);
    }
  }

  // Copy to vendor
  console.log("\n📁 Updating vendor/...");
  if (existsSync(VENDOR_DIR)) {
    rmSync(VENDOR_DIR, { recursive: true, force: true });
  }
  mkdirSync(VENDOR_DIR, { recursive: true });

  if (existsSync(systemPromptsDir)) {
    copyDir(systemPromptsDir, join(VENDOR_DIR, "system-prompts"));
  }

  // Also copy tools if present
  const toolsDir = join(TEMP_DIR, "tools");
  if (existsSync(toolsDir)) {
    copyDir(toolsDir, join(VENDOR_DIR, "tools"));
  }

  // Update lock
  const newLock: LockFile = {
    repo: UPSTREAM_REPO,
    commit,
    fetchedAt: new Date().toISOString(),
    files: newFiles,
  };
  saveLock(newLock);

  // Cleanup
  rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log("\n✅ Sync complete.");
  console.log(`   Commit: ${commit}`);
  console.log(`   Files: ${Object.keys(newFiles).length}`);

  // Return diff info for programmatic use
  return { added, changed, removed, commit };
}

main().catch((e) => {
  console.error("❌ Sync failed:", e);
  process.exit(1);
});
