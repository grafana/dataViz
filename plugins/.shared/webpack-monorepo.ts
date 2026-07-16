import fs from 'node:fs';
import path from 'node:path';
import webpack, { type Configuration, type RuleSetRule } from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';
import grafanaConfig, { type Env } from '../.config/webpack/webpack.config.ts';

// Re-export so per-package (Layer 3) configs can type their `env` argument
// without reaching into the vendored `.config` base directly.
export type { Env };

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

// The vendored base derives its create-plugin version banner from a per-plugin
// `<cwd>/.config/.cprc.json`, which does not exist in the monorepo (the base
// lives once at `plugins/.config`). Read the shared file so the banner reflects
// the actual vendored create-plugin version instead of the missing-file
// fallback object.
function vendoredCreatePluginVersion(): string {
	try {
		const cprcPath = path.resolve(import.meta.dirname, '../.config/.cprc.json');
		const parsed: unknown = JSON.parse(fs.readFileSync(cprcPath, 'utf8'));
		if (parsed && typeof parsed === 'object' && typeof (parsed as { version?: unknown }).version === 'string') {
			return (parsed as { version: string }).version;
		}
	} catch {
		// Missing/unreadable .cprc.json: fall back to the same sentinel the base uses.
	}
	return 'unknown';
}

// Because the base's per-plugin `.cprc.json` lookup misses in the monorepo, its
// `BannerPlugin` renders `version: [object Object]`. Rebuild that plugin with
// the version sourced from the shared `.config/.cprc.json`. We recreate rather
// than mutate because BannerPlugin precomputes its banner in the constructor.
function fixCreatePluginVersionBanner(base: Configuration, version: string): void {
	if (!Array.isArray(base.plugins)) {
		return;
	}
	base.plugins = base.plugins.map((plugin) => {
		const options = (plugin as { options?: { banner?: unknown; raw?: boolean; entryOnly?: boolean } } | undefined)
			?.options;
		if (
			plugin?.constructor?.name === 'BannerPlugin' &&
			options &&
			typeof options.banner === 'string' &&
			options.banner.includes('[create-plugin]')
		) {
			return new webpack.BannerPlugin({
				banner: options.banner.replace('[object Object]', version),
				raw: options.raw,
				entryOnly: options.entryOnly,
			});
		}
		return plugin;
	});
}

export async function monorepoConfig(env: Env): Promise<Configuration> {
	const base = await grafanaConfig(env);

	if (base.module && Array.isArray(base.module.rules)) {
		applyMonorepoSwcOptions(base.module.rules as (RuleSetRule | '...')[]);
	}

	fixCreatePluginVersionBanner(base, vendoredCreatePluginVersion());

	// The vendored base points `cache.buildDependencies.config` at a per-plugin
	// `<cwd>/.config/webpack/webpack.config.ts`, which does not exist in the
	// monorepo (the base lives once at `plugins/.config`). Repoint it in-place at
	// the real base + this override so webpack's filesystem cache invalidates
	// correctly. We overwrite rather than merge because webpack-merge would
	// concatenate the arrays and keep the unresolvable package-local path.
	if (base.cache && typeof base.cache === 'object') {
		base.cache.buildDependencies = {
			config: [path.resolve(import.meta.dirname, '../.config/webpack/webpack.config.ts'), import.meta.filename],
		};
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
		plugins: [
			// Enabled via `--env analyze` (see each package's `build:analyze` script).
			// Static reports avoid port collisions when Turbo runs every package at once.
			...(env.analyze
				? [
						new BundleAnalyzerPlugin({
							analyzerMode: 'static',
							openAnalyzer: true,
							reportFilename: 'bundle-report.html',
						}),
					]
				: []),
		],
	});
}

export default monorepoConfig;
