# Agent guidance

The Git root is above `plugins/`. Run pnpm, Turbo, and development Docker commands from `plugins/`.

## Every change

- Validate: `pnpm install --frozen-lockfile`, then `pnpm check`. When intentionally changing
  dependencies, use `pnpm install` and commit the lockfile update.
  For one package: `pnpm --filter <package-name> run test:ci`. Do not use watch-mode `test`.
- All packages use Jest. Preserve canvas snapshots and their documented review workflow.
- The clock and ECharts packages keep their own toolchains. Do not apply workspace Biome
  conventions to them. Read the package-local AGENTS.md before modifying ECharts.
- Turbo matches exact script names. A renamed script can silently stop checking a package.

## Read only when needed

- Writing or reviewing tests: [contribute/testing.md](contribute/testing.md).
- Changing CI: "GitHub Actions workflows" and "Testing CI changes locally" in DEVELOPING.md.
- Adding a package: "Adding a new plugin package" or "Adding a new shared package" in DEVELOPING.md.
- Importing a plugin: "Bringing a plugin into this monorepo" in DEVELOPING.md.
- Editing `src/plugin.json`: `.claude/commands/plugin-metadata.md`.
- Signing error: [Signed commits](CONTRIBUTING.md#signed-commits). Never disable signing.

## Git

- Sign every commit with the contributor's configured identity.
- Get explicit approval before `git push` and before rewriting published history.
  A request to open a PR does not authorize a push.
- Report checks you skipped or could not run.
