# Contributing to dataViz

## Preparing a contribution

Search existing issues and open PRs for overlapping work. Link related work and dependencies;
coordinate with maintainers before substantial changes. Keep each PR focused on one change.
Describe the problem, resulting behavior, and validation performed. Include regression tests with
bug fixes and meaningful coverage with new functionality. Include before/after screenshots for
visible UI changes, and check keyboard access, semantic HTML, accessible names, and theme behavior.

AI-assisted contributions are welcome. Read and understand every change, including generated tests;
the contributor remains responsible for correctness and for answering review questions. Report
checks that could not run rather than claiming they passed.

Read the [testing guide](contribute/testing.md) for shared quality standards and local commands.
Agents must also read [AGENTS.md](AGENTS.md). Report vulnerabilities through
[Grafana's security reporting page](https://grafana.com/legal/report-a-security-issue/), not public issues.

## Setup and checks

Use the Node version in `plugins/.nvmrc` and pnpm version in `plugins/package.json`.
From `plugins/`, run `pnpm install --frozen-lockfile`, then `pnpm check`.
For a focused change, run `pnpm --filter <package-name> run test:ci` during development.
The [development guide](DEVELOPING.md) describes builds, the Docker development stack,
package exceptions, and E2E checks. Build and inspect the affected plugin before submitting UI changes.

Follow the [Grafana CLA process](https://grafana.com/docs/grafana/latest/developers/cla/)
when prompted on your PR. Preserve each imported package's license and attribution.

## Signed commits

Every contributed commit must have a signature that GitHub verifies, including commits authored
with an agent. A `Signed-off-by` trailer (`git commit -s`) is not a cryptographic signature.

Set up [SSH or GPG commit signing](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
with your own identity and register the public signing key with GitHub. Once configured:

```bash
git config --local commit.gpgsign true
git commit -S -m "docs: clarify contribution guidance"
git log --show-signature -1
```

[Check GitHub's verification status](https://docs.github.com/en/authentication/troubleshooting-commit-signature-verification/checking-your-commit-and-tag-signature-verification-status)
on every commit in the PR; local signing alone does not guarantee GitHub verification.
If signing fails, fix the key or signing-agent setup rather than disabling signing. Preserve original
authorship when repairing signatures. Coordinate before rewriting published history; agents must
obtain explicit approval before doing so. Do not re-sign another contributor's commits as your own.
