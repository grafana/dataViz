# Agent guidance

## Contribution workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md) and applicable directory instructions before editing.
Keep changes focused and follow surrounding conventions. Add comments for non-obvious reasons,
not to narrate self-explanatory code. Read [contribute/testing.md](contribute/testing.md) before
writing or running tests; it routes to the checked-in shared testing skills and local commands.

Use the contributor's configured signing identity for every commit. Never disable signing to get
past an error or fabricate an identity. Preserve authorship; get explicit approval before rewriting
published history. Follow the signing setup in CONTRIBUTING.md.

Before `git push`, stop, summarize changes and validation, and obtain explicit human approval.
A request to open a PR does not by itself authorize pushing. Report unavailable or skipped checks.

## Repository essentials

The Git root is above `plugins/`; run pnpm, Turbo, and development Docker commands from `plugins/`.
Read [DEVELOPING.md](DEVELOPING.md) for architecture, CI, import, and release instructions.

- All packages use Jest. Run focused `test:ci`, not watch-mode `test`, during automated validation.
- Imported clock and ECharts packages retain their own toolchains. Do not apply workspace Biome
  conventions indiscriminately. Read package-local agent instructions before modifying ECharts.
- Preserve canvas snapshots and their documented review workflow.
- Turbo matches exact script names; a renamed script can silently stop checking a package.
- Before changing CI, read DEVELOPING.md's workflow security and local validation sections.
