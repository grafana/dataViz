import path from 'node:path';
import type { Configuration, RuleSetRule } from 'webpack';
import { merge } from 'webpack-merge';
import grafanaConfig, { type Env } from '../.config/webpack/webpack.config.ts';

// Layer 2 of the build-config chain: monorepo-wide overrides applied on top of
// the verbatim create-plugin base (`plugins/.config/webpack/webpack.config.ts`).
// Per-package configs (Layer 3) merge their entry/plugin-id specifics on top of
// what this module returns.

const SOURCE_DIR = 'src';

type SwcLoaderUse = { loader: string; options?: unknown };

// SWC transform options the whole monorepo standardises on.
//
// Grafana shares a single React across all plugins and only reliably provides
// `react/jsx-runtime` at runtime (see the externals in the vendored base). We
// therefore force the automatic runtime with `development: false` so the build
// never emits `react/jsx-dev-runtime` (which crashes with "jsxDEV is not a
// function"). The create-plugin base leaves the React runtime unset, so we
// override it here to keep parity with the previously ejected shared config.
function monorepoSwcOptions(): Record<string, unknown> {
	return {
		jsc: {
			baseUrl: path.resolve(process.cwd(), SOURCE_DIR),
			target: 'es2015',
			loose: true,
			transform: {
				react: {
					runtime: 'automatic',
					development: false,
				},
			},
			parser: {
				syntax: 'typescript',
				tsx: true,
				decorators: true,
				dynamicImport: true,
				types: false,
			},
		},
	};
}

function isSwcLoaderUse(item: unknown): item is SwcLoaderUse {
	return (
		typeof item === 'object' &&
		item !== null &&
		'loader' in item &&
		typeof (item as { loader?: unknown }).loader === 'string' &&
		(item as { loader: string }).loader.includes('swc-loader')
	);
}

// Replace the swc-loader options in the vendored base's module rules with the
// monorepo's, in-place, so we keep every other (upstream-owned) rule verbatim.
function applyMonorepoSwcOptions(rules: (RuleSetRule | '...')[]): void {
	for (const rule of rules) {
		if (typeof rule !== 'object' || rule === null) {
			continue;
		}
		const { use } = rule;
		const items = Array.isArray(use) ? use : [use];
		for (const item of items) {
			if (isSwcLoaderUse(item)) {
				item.options = monorepoSwcOptions();
			}
		}
	}
}

export async function monorepoConfig(env: Env): Promise<Configuration> {
	const base = await grafanaConfig(env);

	if (base.module && Array.isArray(base.module.rules)) {
		applyMonorepoSwcOptions(base.module.rules as (RuleSetRule | '...')[]);
	}

	return merge(base, {
		cache: {
			type: 'filesystem',
			// Keep the webpack filesystem cache inside each package's node_modules
			// so Turbo can scope and prune it per workspace rather than sharing a
			// single global directory.
			cacheDirectory: path.resolve(process.cwd(), 'node_modules/.webpack_cache'),
		},
		resolve: {
			alias: {
				// Resolve the shared workspace package to its TypeScript source for
				// fast, type-safe rebuilds without a separate build step.
				'@shared/core': path.resolve(process.cwd(), '../../@shared/core/src'),
			},
		},
	});
}

export default monorepoConfig;
