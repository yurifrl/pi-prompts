---
name: code-review-part-1-base-finder-angles
description: <!--
upstream_path: system-prompts/agent-prompt-code-review-part-1-base-finder-angles.md
upstream_commit: 65618780f67af6ea3930a60caac8078fc382b45e
---

<!--
name: 'Agent Prompt: /code-review part 1 base finder angles'
description: Line-by-line diff scan instructions for the /code-review slash command's finder-angle phase
ccVersion: 2.1.160
-->
### Angle A — line-by-line diff scan

Read every hunk in the diff, line by line. Then Read the enclosing function for
each hunk — bugs in unchanged lines of a touched function are in scope (the PR
re-exposes or fails to fix them). For every line ask: what input, state, timing,
or platform makes this line wrong? Look for inverted/wrong conditions,
off-by-one, null/undefined deref, missing `await`, falsy-zero checks,
wrong-variable copy-paste, error swallowed in catch, unescaped regex metachars.
