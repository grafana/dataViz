import path from 'node:path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import webpack, { type Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import { type Env, monorepoConfig } from '../../../.shared/webpack-monorepo.ts';
import packageJson from './package.json' with { type: 'json' };

// Layer 3 of the build-config chain: per-package overrides merged on top of the
// monorepo layer (`plugins/.shared/webpack-monorepo.ts`), which itself sits on
// the verbatim create-plugin base (`plugins/.config/webpack/webpack.config.ts`).
//
// This is an APP plugin that bundles nested ECharts panel plugins. Entry
// discovery (each `src/modules/<family>/module.tsx` becomes its own entry),
// nested `plugin.json` copying, and template replacement are handled by the
// lower layers via `getEntries()` / `copyFilePatterns`. Two echarts-specific
// concerns live here: de-duplicating the ECharts runtime into a single async
// chunk, and copying each nested panel's `img/` logo (the base only copies the
// root logo + JSON).

const PLUGIN_ID = 'grafana-echarts-app';

const config = async (env: Env): Promise<Configuration> => {
	const base = await monorepoConfig(env);

	// De-duplicate the ECharts runtime across the nested panel entries. Each
	// panel registers a React.lazy wrapper (see lib/components/LazyPanel), so the
	// Panel and its ECharts import only ever live in async chunks; this cacheGroup
	// collapses the ECharts/zrender modules shared by those async chunks into a
	// single `echarts` chunk emitted once.
	//
	// Only `async` chunks are split: Grafana's plugin loader fetches just each
	// entry `module.js`, and webpack's runtime lazy-loads async chunks via the
	// dynamic publicPath (see lib/publicPath.ts). Splitting `initial` chunks would
	// instead emit sibling chunks Grafana never loads, hanging the panel factory.
	const merged = merge(base, {
		optimization: {
			splitChunks: {
				chunks: 'async',
				cacheGroups: {
					echarts: {
						test: /[\\/]node_modules[\\/](\.pnpm[\\/].*[\\/])?(echarts|zrender)[\\/]/,
						name: 'echarts',
						chunks: 'async',
						enforce: true,
					},
				},
			},
		},
		plugins: [
			new webpack.EnvironmentPlugin({
				NODE_ENV: env.development ? 'development' : 'production',
				PLUGIN_ID,
				CURRENT_VERSION: packageJson.version,
			}),
			// Copy each nested panel's `img/` assets. The base `copyFilePatterns`
			// only copies the app's root logo (`img/logo.svg`) and every JSON
			// (incl. the nested `plugin.json`s), but not the nested `.svg` logos
			// each nested `plugin.json` references. `context` is pinned to `src` so
			// `[path]` preserves `modules/<family>/img/` under `dist`.
			new CopyWebpackPlugin({
				patterns: [
					{
						from: 'modules/**/img/**',
						to: '[path][name][ext]',
						context: path.resolve(process.cwd(), 'src'),
						noErrorOnMissing: true,
					},
				],
			}),
		],
	});

	return merged;
};

export default config;
