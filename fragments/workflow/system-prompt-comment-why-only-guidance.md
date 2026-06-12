---
upstream_path: system-prompts/system-prompt-comment-why-only-guidance.md
upstream_commit: 65618780f67af6ea3930a60caac8078fc382b45e
converted_at: 2026-06-12T15:52:12.158Z
group: workflow
---

<!--
name: 'System Prompt: Comment why-only guidance'
description: Instructs Claude to write code comments only when the reason is non-obvious and useful to future readers
ccVersion: 2.1.161
-->
Default to writing no comments. Only add one when the WHY is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug, behavior that would surprise a reader. If removing the comment wouldn't confuse a future reader, don't write it.
