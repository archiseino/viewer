---
name: repo-verify
description: >
  Verifies the correct GitHub repository is used before creating issues or PRs.
  Use ONLY when the user asks to create an issue, pull request, or run any gh
  command that targets a repository. Checks that --repo archiseino/viewer is
  set to prevent accidentally targeting the upstream johnfactotum/foliate-js
  repo.
---

# repo-verify — GitHub Repository Verification

Always verify the repository target before running `gh issue create`, `gh pr create`,
or any `gh` command that creates/modifies remote resources.

## Problem

The `gh` CLI may have `johnfactotum/foliate-js` set as the default repo (from
the upstream remote). Running `gh issue create` without an explicit `--repo`
flag will create issues on the upstream repo instead of the fork.

## Rule

**Always pass `--repo archiseino/viewer`** to every `gh` command that targets
a repository:

```bash
gh issue create --repo archiseino/viewer --title "..." --body "..."
gh pr create --repo archiseino/viewer --title "..." --body "..."
gh issue list --repo archiseino/viewer
```

**Also don't copy the markdown issue literally** create the abstraction of the problem and let the model later have it's own implementation of the solution. The markdown issue is just a reference for the problem and solution, not a template to be copied verbatim.

## Exceptions

- `gh repo view`, `gh api`, and other read-only commands that don't mutate
  remote state may use the default repo — but when in doubt, use `--repo`.
- Commands explicitly scoped to `johnfactotum/foliate-js` (e.g., contributing
  upstream) should use `--repo johnfactotum/foliate-js` intentionally.
