# Testing contributions

When writing or reviewing tests, read the
[frontend testing strategy](../.claude/skills/frontend-testing-strategy/SKILL.md).
For chart rendering and interactions, also read the
[panel testing strategy](../.claude/skills/panel-testing-strategy/SKILL.md).
These Markdown guides require no agent installation or private access.

To run existing tests, use [validation commands](../AGENTS.md#every-change).
Build commands are in DEVELOPING.md, "Commands (run from `plugins/`)".

## Local test conventions

All packages use Jest. Preserve package-specific mocks, canvas patches, and snapshot conventions.
Imported packages retain ESLint/Prettier and their own build configurations. Workspace packages use
Biome. For exceptions, read only the applicable DEVELOPING.md section:
"`grafana-clock-panel` is a special case" or "`grafana-echarts` is a special case too".
For E2E, use the affected package's Playwright scripts, configuration, and provisioned Grafana stack.
Grafana core's automatic test-server command does not apply here.

## Visualization adapter

For ECharts rendering changes, read the package-local AGENTS.md and its canvas snapshot workflow.
For other plugins, use their existing data builders, rendering harnesses, and colocated tests.
Do not import Grafana core's panel-props or canvas test helpers unless the package already uses them.
Use the affected package's Playwright configuration for interaction and accessibility checks.

## Provenance

[shared-testing-source.json](../.claude/skills/shared-testing-source.json) records the original source
and hashes of these locally adapted copies. The hashes do not assert equality with the upstream
files. No automated drift check consumes them. Update them when changing the local skills.
Publication of a canonical shared repository is a follow-up. Preserve the
[skill license](../.claude/skills/SHARED-TESTING-LICENSE) when distributing them.
