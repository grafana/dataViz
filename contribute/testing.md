# Testing contributions

Read the checked-in [frontend testing strategy](../.claude/skills/frontend-testing-strategy/SKILL.md).
For chart rendering and interactions, also read the
[panel testing strategy](../.claude/skills/panel-testing-strategy/SKILL.md).
These Markdown guides require no agent installation or private access. Local commands and fixtures
below specialize those principles. Provenance and content hashes live in
[shared-testing-source.json](../.claude/skills/shared-testing-source.json); publication of the shared
source is pending. Update shared copies together through reviewed PRs, preserving the adjacent license.


## dataViz

Run commands from `plugins/`: `pnpm install --frozen-lockfile`, then `pnpm check` (format,
non-watch tests, lint, and type checking). During development use
`pnpm --filter <package-name> run test:ci`. Build the affected package with
`pnpm --filter <package-name> run build`.

All packages use Jest. Preserve package-specific Jest mocks, canvas patches, and snapshot conventions.
Imported packages retain ESLint/Prettier and their own build configurations; workspace packages use
Biome. Read [DEVELOPING.md](../DEVELOPING.md) and nested agent instructions for those exceptions.
For E2E, use the affected package's Playwright scripts, configuration, and provisioned Grafana stack;
Grafana core's automatic test-server command does not apply here.
