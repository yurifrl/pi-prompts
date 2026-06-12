---
name: "pi-prompts-update"
description: "Sync and convert upstream Claude Code prompts for pi-prompts package. Run when updating from Piebald repo."
allowed-tools:
  - Read
  - Bash
  - Edit
  - Write
  - Grep
---

# pi-prompts Update Skill

Orchestrates the update loop for the `pi-prompts` package located at `~/pi-prompts (or ~/.pi/agent/git/github.com/yurifrl/pi-prompts)`.

## Package Location

```
/Users/yuri/Workdir/Yuri/pi-prompts/
├── upstream.lock.json     # Version tracking (commit, hashes)
├── conversion-map.json    # Curation rules (groups, include/exclude)
├── vendor/                # Raw upstream snapshot
├── fragments/             # Output: grouped system prompts
├── skills/                # Output: converted skills
├── agents/                # Output: converted agents
├── prompts/               # Output: slash command templates
└── scripts/
    ├── sync.ts            # Fetch upstream → vendor + lock + diff
    └── convert.ts         # vendor → outputs via conversion-map
```

## Update Workflow

**Core loop — execute in order:**

1. **Sync upstream**
   ```bash
   cd ~/pi-prompts (or ~/.pi/agent/git/github.com/yurifrl/pi-prompts) && bun run scripts/sync.ts
   ```
   - Shallow clones Piebald repo
   - Updates `vendor/system-prompts/`
   - Updates `upstream.lock.json` with commit + file hashes
   - Reports diff: added/changed/removed files

2. **Review diff report**
   - Added files may need classification
   - Changed files → re-convert will update outputs
   - Removed files → converter will delete orphaned outputs

3. **Classify triage items**
   - After sync+convert, unmapped files land in `conversion-map.json` → `triage[]`
   - For each triage item, decide:
     - Add to a group in `groups.<name>.files[]`
     - Add to `skills.include[]`, `agents.include[]`, or `prompts.include[]`
     - Add to `exclude[]` (CC-specific, not relevant for pi)
     - Create a **new group** if needed (requires updating extension defaults too)

4. **Run convert**
   ```bash
   cd ~/pi-prompts (or ~/.pi/agent/git/github.com/yurifrl/pi-prompts) && bun run scripts/convert.ts
   ```
   - Reads `conversion-map.json`
   - Processes `vendor/` → `fragments/`, `skills/`, `agents/`, `prompts/`
   - Clears and regenerates output dirs (orphan cleanup automatic)
   - Adds provenance frontmatter to each file

5. **Inspect changed fragments**
   - Spot-check a few converted files
   - Verify frontmatter has correct `upstream_commit`
   - Check that content makes sense for pi (no CC-specific references)

6. **Commit**
   ```bash
   cd ~/pi-prompts (or ~/.pi/agent/git/github.com/yurifrl/pi-prompts)
   git add -A
   git commit -m "sync: upstream <commit-sha-short>"
   git push
   ```

## Classification Guidelines

**Groups (system prompt injection):**
- `doing-tasks`: task execution, SW engineering focus, security, no compat hacks
- `tone`: communication style, conciseness, emoji avoidance
- `safety`: action safety, truthful reporting, executing with care
- `workflow`: analyze before implementing, prefer editing, harness instructions

**Exclude patterns (CC-specific, don't convert):**
- `data-*` — API reference docs
- `system-prompt-dream-*` — Claude Code dream/memory consolidation
- `system-prompt-insights-*` — insights mode
- `system-prompt-chrome-*`, `system-prompt-claude-in-chrome-*` — browser automation
- `system-prompt-cowork-*`, `system-prompt-coordinator-*` — cowork plugins
- `system-prompt-memory-*` — CC memory system
- `system-prompt-learning-mode*` — learning mode
- `system-prompt-powershell-*`, `system-prompt-wsl-*` — Windows-specific
- `system-reminder-*` — transient reminders, not persistent prompts
- `tool-description-*` — tool docs (pi has its own)
- `skill-cowork-*`, `skill-design-sync*` — CC-specific skills
- `agent-prompt-managed-*`, `agent-prompt-schedule-*` — managed agents (CC cloud)

**Skills worth including:**
- `skill-debugging.md`, `skill-verify-skill.md` — general techniques
- `skill-agent-design-patterns.md` — sub-agent patterns
- `skill-run-*.md` — running different app types

**Agents worth including:**
- `agent-prompt-explore.md`, `agent-prompt-general-purpose.md`
- `agent-prompt-code-review-*.md` — code review flow
- `agent-prompt-quick-git-commit.md`, `agent-prompt-quick-pr-creation.md`

## Absorption Pattern

When upstream adds something new:

1. Script (`sync.ts`) detects it, adds to diff report
2. Script (`convert.ts`) adds unmapped files to `triage[]`
3. **This skill classifies** — edit `conversion-map.json`:
   - Move from `triage[]` to appropriate destination
   - Or add new exclude pattern
4. Re-run `convert.ts`
5. If a new pattern emerges (e.g., upstream adds `output-style-*.md` category):
   - May need to extend `convert.ts` with new conversion rules
   - May need to create new group in `conversion-map.json` + extension defaults

## Quick Commands

```bash
# Full update
cd ~/pi-prompts (or ~/.pi/agent/git/github.com/yurifrl/pi-prompts) && bun run scripts/sync.ts && bun run scripts/convert.ts

# Check current version
cat ~/pi-prompts (or ~/.pi/agent/git/github.com/yurifrl/pi-prompts)/upstream.lock.json | jq '.commit, .fetchedAt'

# See triage backlog
cat ~/pi-prompts (or ~/.pi/agent/git/github.com/yurifrl/pi-prompts)/conversion-map.json | jq '.triage | length'

# Test extension locally
/pi-prompts status
```
