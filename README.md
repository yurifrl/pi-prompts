# pi-prompts

Claude Code system prompts adapted for [pi](https://pi.dev). Pulls from [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts), curates the relevant bits, and injects them into pi's system prompt via extension.

## Features

- **Grouped fragments**: Curated system prompt snippets organized by category (`doing-tasks`, `tone`, `safety`, `workflow`)
- **Skills**: Converted skill files from Claude Code
- **Agents**: Sub-agent prompts converted to pi format
- **Prompts**: Slash command templates
- **Toggle control**: `/pi-prompts on|off` to enable/disable injection
- **Per-group control**: `/pi-prompts <group> on|off`
- **Version tracking**: Upstream commit + file hashes in `upstream.lock.json`

## Installation

Add to your `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "/path/to/pi-prompts"
  ]
}
```

## Usage

```bash
/pi-prompts          # Show status: ON/OFF, enabled groups, upstream version
/pi-prompts on       # Enable prompt injection
/pi-prompts off      # Disable prompt injection
/pi-prompts tone off # Disable specific group
/pi-prompts safety on # Enable specific group
```

## Groups

| Group | Description |
|-------|-------------|
| `doing-tasks` | Software engineering focus, ambitious tasks, security, no unnecessary additions |
| `tone` | Communication style, conciseness, emoji avoidance |
| `safety` | Action safety, truthful reporting, executing with care |
| `workflow` | Analyze before implementing, prefer editing existing files |

Default: `doing-tasks`, `tone`, `workflow` enabled; `safety` disabled.

## Syncing Upstream

```bash
# Fetch latest from Piebald repo
bun run scripts/sync.ts

# Convert vendor/ to fragments/skills/agents/prompts
bun run scripts/convert.ts
```

New unmapped files land in the `triage` list in `conversion-map.json` for manual classification.

## Structure

```
pi-prompts/
├── package.json           # pi package manifest
├── upstream.lock.json     # Version tracking
├── conversion-map.json    # Curation rules
├── vendor/                # Raw upstream snapshot
├── fragments/             # Grouped system prompt snippets
│   ├── doing-tasks/
│   ├── tone/
│   ├── safety/
│   └── workflow/
├── skills/                # Converted skills
├── agents/                # Converted sub-agent prompts
├── prompts/               # Slash command templates
├── extensions/
│   └── pi-prompts.ts      # Extension: injection + /pi-prompts command
└── scripts/
    ├── sync.ts            # Fetch upstream
    └── convert.ts         # Convert to pi format
```

## State

Runtime state lives at `~/.pi/agent/extensions/pi-prompts/state.json`:

```json
{
  "enabled": true,
  "groups": { "doing-tasks": true, "tone": true, "workflow": true, "safety": false }
}
```

Project override: `.pi/extensions/pi-prompts/state.json`

## License

MIT
