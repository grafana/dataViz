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

Read the [testing guide](contribute/testing.md) when writing or reviewing tests.
Report vulnerabilities through
[Grafana's security reporting page](https://grafana.com/legal/report-a-security-issue/), not public issues.

## Setup and checks

Use the Node version in `plugins/.nvmrc` and pnpm version in `plugins/package.json`.
Use the [validation commands](AGENTS.md#every-change) from `plugins/`.
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
git commit -m "docs: clarify contribution guidance"
```

[Check GitHub's verification status](https://docs.github.com/en/authentication/troubleshooting-commit-signature-verification/checking-your-commit-and-tag-signature-verification-status)
on every commit in the PR. Local signing alone does not guarantee GitHub verification.
If signing fails, fix the key or signing-agent setup rather than disabling signing. Preserve original
authorship when repairing signatures. Coordinate before rewriting published history; agents must
obtain explicit approval before doing so. Do not re-sign another contributor's commits as your own.

For local SSH signature verification with `git log --show-signature`, first configure
`gpg.ssh.allowedSignersFile` with the trusted signing identity and public key. An error about a
missing allowed-signers file means local verification is not configured. It does not mean signing failed.

## Testing skill licenses

The two Markdown skills under `.claude/skills/frontend-testing-strategy/` and
`.claude/skills/panel-testing-strategy/` adapt guidance from grafana/grafana. They retain
AGPL-3.0-only, with the text in [SHARED-TESTING-LICENSE](.claude/skills/SHARED-TESTING-LICENSE).
They are development guidance, not plugin implementation files. This exception does not replace
this repository's Apache-2.0 license or the licenses of imported plugins. Moving these skills to a
shared repository does not itself change their license. Any relicensing requires authorization.
