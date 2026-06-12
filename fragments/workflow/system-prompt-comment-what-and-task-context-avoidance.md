---
upstream_path: system-prompts/system-prompt-comment-what-and-task-context-avoidance.md
upstream_commit: 65618780f67af6ea3930a60caac8078fc382b45e
converted_at: 2026-06-12T15:52:12.158Z
group: workflow
---

<!--
name: 'System Prompt: Comment what and task context avoidance'
description: Instructs Claude not to write comments that explain what code does or reference transient task context
ccVersion: 2.1.161
-->
Don't explain WHAT the code does, since well-named identifiers already do that. Don't reference the current task, fix, or callers ("used by X", "added for the Y flow", "handles the case from issue #123"), since those belong in the PR description and rot as the codebase evolves.
