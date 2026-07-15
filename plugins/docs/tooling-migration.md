# Tooling Migration Guide: Jest/ESLint/Prettier to Biome + Vitest

This guide is for bringing an existing Grafana plugin into this monorepo when that
plugin already ships its own tooling — typically **Jest** (tests), **ESLint**
(linting), and **Prettier** (formatting).

It covers two paths:

1. **[Recommended: migrate to Biome + Vitest](#recommended-path-migrate-to-biome--vitest)** — converge on the repo standard.
2. **[Fallback: keep Jest / ESLint / Prettier](#fallback-keep-jest--eslint--prettier)** — how to let a plugin keep its own toolchain when migration can't happen yet.

## Why this exists

The repo standard is **Biome + Vitest**. That's declared once at the workspace
root:

- Biome (lint + format) is configured in [`biome.json`](../biome.json) and pinned in [`package.json`](../package.json) devDependencies (`@biomejs/biome`).
- Vitest is a root devDependency with a shared config in [`vitest.config.base.mts`](../vitest.config.base.mts) and a shared setup file in [`vitest.setup.ts`](../vitest.setup.ts).

An incoming plugin that keeps Jest/ESLint/Prettier will *run* fine (see the
[fallback](#fallback-keep-jest--eslint--prettier) section for why), but it won't
benefit from the shared config, it adds duplicate dependencies, and — most
importantly — its Prettier formatting will fight the repo-wide Biome formatter.
Converging on the standard avoids all of that.

## How the toolchain is wired

Understanding this makes both paths obvious.

- **Turborepo orchestrates by script name, not by tool.** The root scripts in
  [`package.json`](../package.json) are thin wrappers: `pnpm lint` runs
  `turbo lint`, which runs the `lint` script in *every* package that defines
  one. Turbo does not care whether that script invokes `biome`, `eslint`, or
  anything else.

- **The aggregate gate is `check`:**

  ```json
  "check": "turbo format test:ci lint type-check"
  ```

  So a package participates in CI by defining `format`, `test:ci`, `lint`, and
  `type-check` scripts — regardless of what backs them.

- **Vitest config is shared.** Each package's `vitest.config.mts` just
  re-exports the base config, which already handles the tricky Grafana bits
  (`@grafana/ui` SSR `noExternal`, `jsdom`, `uplot` inlining, path aliases). See
  [`grafana-workspace-panel/vitest.config.mts`](../packages/@plugins/grafana-workspace-panel/vitest.config.mts).

- **Biome config is repo-wide.** [`biome.json`](../biome.json) uses
  `files.includes: ["**", ...]`, so it globs the entire tree. This is the key
  reason a Prettier-formatted plugin conflicts: Biome will try to reformat files
  the plugin's own Prettier also owns.

---

## Recommended path: migrate to Biome + Vitest

Do these in order — the steps are listed from lowest to highest risk. You can
land each step independently.

### 1. Jest to Vitest (low risk)

Vitest's API is close to Jest's, so this is usually mechanical.

1. **Remove Jest config and dependencies** from the package:
   - Delete `jest.config.{js,ts,cjs,mjs}`, `jest.setup.*`, and any
     `"jest"` block in the package's `package.json`.
   - Remove devDependencies: `jest`, `ts-jest`, `babel-jest`,
     `@types/jest`, `jest-environment-jsdom`, `@testing-library/jest-dom`
     (its matchers ship differently under Vitest — see note below), and any
     `identity-obj-proxy`/CSS-mock packages.

2. **Add a Vitest config** that re-exports the shared base. Create
   `vitest.config.mts` in the package:

   ```ts
   import { createVitestConfig } from '../../../vitest.config.base.mts';

   export default createVitestConfig();
   ```

   (Adjust the relative depth to reach the repo root
   [`vitest.config.base.mts`](../vitest.config.base.mts).)

3. **Add an alias if other packages import this one in tests.** If tests resolve
   this package by its workspace alias, add it under `resolve.alias` in
   [`vitest.config.base.mts`](../vitest.config.base.mts), mirroring the existing
   `@shared/core` / `@grafana-workspace-panel` entries.

4. **Set the test scripts** in the package's `package.json`:

   ```json
   "test": "vitest",
   "test:ci": "vitest run"
   ```

5. **Codemod the test sources.** Common replacements:

   | Jest | Vitest |
   | --- | --- |
   | `jest.fn()` | `vi.fn()` |
   | `jest.mock(...)` | `vi.mock(...)` |
   | `jest.spyOn(...)` | `vi.spyOn(...)` |
   | `jest.requireActual(...)` | `await vi.importActual(...)` |
   | `jest.useFakeTimers()` | `vi.useFakeTimers()` |
   | `jest.clearAllMocks()` | `vi.clearAllMocks()` |

   Import `vi` from `vitest` where needed. Because the base config sets
   `globals: true`, `describe`/`it`/`expect` do not need imports. Note that
   `vi.mock` is hoisted like `jest.mock`, but factory functions can't reference
   out-of-scope variables unless prefixed with `mock` — see the
   [Vitest migration guide](https://vitest.dev/guide/migration.html) for edge
   cases.

6. **Move global DOM shims into the shared setup.** If the plugin relied on
   Jest setup shims (e.g. `IntersectionObserver`, `matchMedia`), note that
   [`vitest.setup.ts`](../vitest.setup.ts) already stubs those. Add anything
   plugin-specific there, or to a package-local setup file referenced from your
   config, rather than duplicating the base ones.

> Note on `jest-dom` matchers: if tests use `toBeInTheDocument()` etc., add
> `@testing-library/jest-dom` and import `@testing-library/jest-dom/vitest` from
> a setup file. Keep it out of the shared setup unless every package needs it.

### 2. Prettier to Biome format (do this one — it actively conflicts if left)

This is the step that *breaks* if you skip it, because repo-wide Biome and the
plugin's Prettier will reformat the same files differently on every save/commit.

1. **Remove Prettier** config and deps: `.prettierrc*`, `prettier.config.*`,
   `.prettierignore`, and the `prettier` devDependency (plus any
   `eslint-config-prettier` / `eslint-plugin-prettier`).

2. **Point the format scripts at Biome:**

   ```json
   "format": "biome format src",
   "format:fix": "biome format --write src"
   ```

3. **Reformat once** to adopt the repo style:

   ```bash
   pnpm --filter <package-name> exec biome format --write src
   ```

4. **Expect style deltas.** The repo's formatter (see
   [`biome.json`](../biome.json)) uses:
   - tab indentation, indent width 2, line width 120;
   - single quotes for JS, double quotes for JSX;
   - `es5` trailing commas, semicolons always, always-parenthesized arrow params.

   This will produce a large one-time diff. Land it as an isolated "reformat"
   commit so it doesn't drown out logic changes.

### 3. ESLint to Biome lint (do this last)

Biome covers most common ESLint rules, but **not all** — read the caveats before
committing.

1. **Remove ESLint** config and deps: `.eslintrc*`, `eslint.config.*`,
   `.eslintignore`, and the `eslint` / `@grafana/eslint-plugin` /
   `eslint-plugin-*` devDependencies.

2. **Point the lint scripts at Biome:**

   ```json
   "lint": "biome lint src",
   "lint:fix": "biome lint --write src"
   ```

3. **Run it and triage:**

   ```bash
   pnpm --filter <package-name> exec biome lint src
   ```

#### Lost coverage — know what you're giving up

Some rules have **no Biome equivalent**. Migrating away from ESLint means losing
them:

- **`@grafana/eslint-plugin` rules** such as `no-untranslated-strings`,
  theme-usage conventions (`useStyles2`/`theme2`), and other Grafana-specific
  guards.
- **Type-aware lint rules** from `@typescript-eslint` (anything requiring the
  type checker, e.g. `no-floating-promises`). Biome does not do type-aware
  linting.

If any of these matter to the plugin, either keep ESLint *just for those rules*
alongside Biome (a hybrid), or accept the loss deliberately.

#### This repo's Biome rules are strict

[`biome.json`](../biome.json) enables a number of rules as **errors** that an
incoming plugin may not currently satisfy, including:

- `noExplicitAny` (error)
- `noExcessiveCognitiveComplexity` (error)
- `noSecrets` (error)
- `useTopLevelRegex` (error)
- `noConsole` (warn, with an allowlist)

Expect violations. Fix them where reasonable; where a rule is genuinely
impractical for a specific plugin, relax it *for that package only* rather than
weakening the repo-wide config (next section).

### Per-package Biome rule relaxation

To let a noisy plugin land without disabling checks for everyone, scope the
relaxation to the package. Two options:

**Option A — nested config (`biome.json` in the package dir):**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.3/schema.json",
  "root": false,
  "extends": "//",
  "linter": {
    "rules": {
      "suspicious": { "noExplicitAny": "off" },
      "complexity": { "noExcessiveCognitiveComplexity": "off" }
    }
  }
}
```

`"root": false` + `"extends": "//"` inherits the workspace root config and only
overrides what you list.

**Option B — `overrides` in the root [`biome.json`](../biome.json):**

```json
"overrides": [
  {
    "includes": ["packages/@plugins/<name>/**"],
    "linter": { "rules": { "suspicious": { "noExplicitAny": "off" } } }
  }
]
```

Prefer Option A so the exception lives with the plugin it applies to. Treat any
relaxation as tech debt to revisit.

### Migration checklist

- [ ] Delete `jest.config.*`, jest setup, and jest deps
- [ ] Add `vitest.config.mts` re-exporting `createVitestConfig()`
- [ ] Add a `resolve.alias` entry in `vitest.config.base.mts` if tests import this package
- [ ] Set `test` / `test:ci` scripts to `vitest` / `vitest run`
- [ ] Codemod `jest.*` -> `vi.*`; move DOM shims into shared setup
- [ ] Delete Prettier config + deps; set `format` / `format:fix` to Biome
- [ ] Run `biome format --write src` and commit the reformat separately
- [ ] Delete ESLint config + deps; set `lint` / `lint:fix` to Biome
- [ ] Audit lost `@grafana/eslint-plugin` / type-aware rules
- [ ] Fix or scope-relax strict Biome rule violations
- [ ] Verify: `pnpm --filter <package-name> exec ...` then `pnpm check` at root

---

## Fallback: keep Jest / ESLint / Prettier

Use this only when migrating now isn't feasible (e.g. a large plugin on a tight
timeline, or one that depends on rules with no Biome equivalent). Treat it as
**temporary**.

Because Turbo dispatches by script name, a package can keep its own toolchain
and still satisfy the root `check` gate — as long as the four expected scripts
exist.

### 1. Keep the package's own scripts

In the package's `package.json`, keep scripts pointing at the old tools:

```json
"scripts": {
  "test": "jest",
  "test:ci": "jest --ci",
  "lint": "eslint src",
  "format": "prettier --check src",
  "format:fix": "prettier --write src",
  "type-check": "tsc --noEmit"
}
```

`pnpm test`, `pnpm lint`, `pnpm format`, and `pnpm check` at the root will run
these unchanged.

### 2. Critical: stop repo-wide Biome from fighting Prettier

This is the one thing you **must** do. Because [`biome.json`](../biome.json)
globs `**`, Biome will otherwise reformat and relint files that the plugin's
Prettier/ESLint also own, causing an endless formatting war. Exclude the
package from the root Biome config's `files.includes`:

```json
"files": {
  "includes": [
    "**",
    "!**/node_modules",
    "!packages/@plugins/<name>/**"
  ]
}
```

Add the same exclusion to `assist`/`formatter` scope implicitly (the top-level
`files.includes` governs all of Biome). After this, Biome ignores the package
entirely and the plugin's own tools are authoritative for it.

### 3. Keep old tooling as package-local devDependencies

Add `jest`, `eslint`, `prettier`, and their plugins to the *package's*
`devDependencies`, **not** the workspace root — this keeps the shared toolchain
clean and makes the eventual removal a single-package change.

Because [`.npmrc`](../.npmrc) sets `ignore-scripts=true` for supply-chain safety,
any package with legitimate lifecycle build steps (rare for these tools) won't
run them automatically; install normally and rebuild explicitly only if needed.

### 4. Give Jest the parity the shared Vitest config provides

The shared Vitest config solves several Grafana-specific problems for free. A
standalone Jest setup must replicate them or tests will fail. Minimal
`jest.config.ts`:

```ts
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Transpile TS/TSX. Use the same SWC the repo already depends on.
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  // Grafana packages ship untranspiled ESM; don't skip transforming them.
  transformIgnorePatterns: ['node_modules/(?!(@grafana|uplot)/)'],
  moduleNameMapper: {
    // Mirror the aliases from vitest.config.base.mts as needed:
    '^@shared/core$': '<rootDir>/../../@shared/core/src',
    // Stub CSS/SCSS imports that webpack handles at build time:
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
};

export default config;
```

And a `jest.setup.ts` replicating the browser globals stubbed in
[`vitest.setup.ts`](../vitest.setup.ts) (`IntersectionObserver`, `matchMedia`):

```ts
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

### Trade-offs (why this is temporary)

- **Dependency bloat**: jest/babel/eslint/prettier duplicate what the root
  already provides via Biome + Vitest, inflating the lockfile and installs.
- **Two linters, no added coverage**: CI effectively runs both toolchains.
- **No shared config**: you re-maintain jsdom/transform/alias/setup that the
  base Vitest config gives every other package for free.
- **Drift risk**: the excluded package silently misses repo-wide Biome rule
  changes.

### Fallback checklist

- [ ] Keep `test` / `test:ci` / `lint` / `format` / `format:fix` scripts on the old tools
- [ ] Exclude the package path in root [`biome.json`](../biome.json) `files.includes`
- [ ] Keep jest/eslint/prettier as **package-local** devDependencies
- [ ] Add `jest.config.ts` replicating jsdom + `@grafana/*` transform + aliases
- [ ] Add `jest.setup.ts` with `IntersectionObserver` / `matchMedia` shims
- [ ] Confirm `pnpm check` at root passes with the package included
- [ ] File a follow-up to migrate (see the [recommended path](#recommended-path-migrate-to-biome--vitest))
