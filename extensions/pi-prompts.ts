import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";

interface State {
  enabled: boolean;
  groups: Record<string, boolean>;
}

const DEFAULT_STATE: State = {
  enabled: false,
  groups: {
    "doing-tasks": true,
    "tone": true,
    "workflow": true,
    "safety": false,
  },
};

const PACKAGE_ROOT = dirname(dirname(import.meta.path));
const FRAGMENTS_DIR = join(PACKAGE_ROOT, "fragments");

function getStateDir(pi: ExtensionAPI): string {
  // Global state: ~/.pi/agent/extensions/pi-prompts/
  const globalDir = join(pi.paths.globalExtensionsDir, "pi-prompts");
  return globalDir;
}

function getStatePath(pi: ExtensionAPI): string {
  // Check project override first
  const projectPath = join(pi.paths.cwd, ".pi", "extensions", "pi-prompts", "state.json");
  if (existsSync(projectPath)) {
    return projectPath;
  }
  return join(getStateDir(pi), "state.json");
}

function loadState(pi: ExtensionAPI): State {
  const path = getStatePath(pi);
  if (!existsSync(path)) {
    return { ...DEFAULT_STATE };
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled ?? DEFAULT_STATE.enabled,
      groups: { ...DEFAULT_STATE.groups, ...parsed.groups },
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(pi: ExtensionAPI, state: State): void {
  const dir = getStateDir(pi);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const path = join(dir, "state.json");
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

function getAvailableGroups(): string[] {
  if (!existsSync(FRAGMENTS_DIR)) return [];
  return readdirSync(FRAGMENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function loadGroupFragments(group: string): string {
  const groupDir = join(FRAGMENTS_DIR, group);
  if (!existsSync(groupDir)) return "";

  const files = readdirSync(groupDir).filter((f) => f.endsWith(".md")).sort();
  const contents: string[] = [];

  for (const file of files) {
    try {
      let content = readFileSync(join(groupDir, file), "utf-8");
      // Strip frontmatter if present
      if (content.startsWith("---")) {
        const endIdx = content.indexOf("---", 3);
        if (endIdx !== -1) {
          content = content.slice(endIdx + 3).trim();
        }
      }
      if (content) contents.push(content);
    } catch {
      // skip unreadable files
    }
  }

  return contents.join("\n\n");
}

function loadUpstreamVersion(): { commit: string | null; fetchedAt: string | null } {
  const lockPath = join(PACKAGE_ROOT, "upstream.lock.json");
  if (!existsSync(lockPath)) return { commit: null, fetchedAt: null };
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
    return { commit: lock.commit, fetchedAt: lock.fetchedAt };
  } catch {
    return { commit: null, fetchedAt: null };
  }
}

export default function (pi: ExtensionAPI) {
  // Register /pi-prompts command
  pi.registerCommand("pi-prompts", {
    description: "Toggle Claude Code prompts injection (on|off) or show status",
    getArgumentCompletions: (prefix: string) => {
      const state = loadState(pi);
      const groups = getAvailableGroups();
      const options = ["on", "off", "status", ...groups];
      const filtered = options.filter((o) => o.startsWith(prefix));
      return filtered.length > 0
        ? filtered.map((o) => ({ value: o, label: o }))
        : null;
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const state = loadState(pi);
      const groups = getAvailableGroups();
      const upstream = loadUpstreamVersion();

      // /pi-prompts (no args) or /pi-prompts status
      if (parts.length === 0 || parts[0] === "status") {
        const groupStatus = groups
          .map((g) => `  ${state.groups[g] ? "✓" : "○"} ${g}`)
          .join("\n");
        const upstreamInfo = upstream.commit
          ? `${upstream.commit.slice(0, 7)} (${upstream.fetchedAt?.split("T")[0] ?? "unknown"})`
          : "not synced";

        ctx.ui.notify(
          `pi-prompts: ${state.enabled ? "ON" : "OFF"}\n\nGroups:\n${groupStatus}\n\nUpstream: ${upstreamInfo}`,
          "info"
        );
        return;
      }

      // /pi-prompts on|off
      if (parts[0] === "on" || parts[0] === "off") {
        state.enabled = parts[0] === "on";
        saveState(pi, state);
        ctx.ui.notify(`pi-prompts: ${state.enabled ? "ON" : "OFF"}`, "info");
        return;
      }

      // /pi-prompts <group> [on|off]
      if (groups.includes(parts[0])) {
        const group = parts[0];
        if (parts[1] === "on" || parts[1] === "off") {
          state.groups[group] = parts[1] === "on";
          saveState(pi, state);
          ctx.ui.notify(`pi-prompts: ${group} ${state.groups[group] ? "ON" : "OFF"}`, "info");
        } else {
          // Toggle
          state.groups[group] = !state.groups[group];
          saveState(pi, state);
          ctx.ui.notify(`pi-prompts: ${group} ${state.groups[group] ? "ON" : "OFF"}`, "info");
        }
        return;
      }

      ctx.ui.notify(`Unknown argument: ${parts[0]}. Use on|off|status|<group>`, "warning");
    },
  });

  // Inject enabled fragments before agent starts
  pi.on("before_agent_start", async (event, _ctx) => {
    const state = loadState(pi);

    if (!state.enabled) {
      return {}; // Short-circuit: no injection
    }

    const enabledGroups = Object.entries(state.groups)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);

    if (enabledGroups.length === 0) {
      return {};
    }

    const fragments: string[] = [];
    for (const group of enabledGroups) {
      const content = loadGroupFragments(group);
      if (content) {
        fragments.push(`<!-- pi-prompts: ${group} -->\n${content}`);
      }
    }

    if (fragments.length === 0) {
      return {};
    }

    const injection = "\n\n" + fragments.join("\n\n") + "\n";

    return {
      systemPrompt: event.systemPrompt + injection,
    };
  });
}
