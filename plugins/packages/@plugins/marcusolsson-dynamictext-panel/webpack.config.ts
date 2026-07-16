import webpack, { type Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import { type Env, monorepoConfig } from '../../../.shared/webpack-monorepo.ts';
import packageJson from './package.json' with { type: 'json' };

// Layer 3 of the build-config chain: per-package overrides merged on top of the
// monorepo layer (`plugins/.shared/webpack-monorepo.ts`), which itself sits on
// the verbatim create-plugin base (`plugins/.config/webpack/webpack.config.ts`).
// Entry, plugin.json resolution, copy rules and template replacement are all
// handled by the lower layers; only genuinely package-specific concerns belong
// here.

const PLUGIN_ID = 'marcusolsson-dynamictext-panel';

const config = async (env: Env): Promise<Configuration> => {
	const base = await monorepoConfig(env);

	return merge(base, {
		plugins: [
			new webpack.EnvironmentPlugin({
				NODE_ENV: env.development ? 'development' : 'production',
				PLUGIN_ID,
				CURRENT_VERSION: packageJson.version,
			}),
		],
		resolve: {
			alias: {
				// Use Handlebars' pre-built browser bundle so webpack does not try to
				// resolve the Node `require.extensions`/`fs` path in its runtime.
				handlebars: 'handlebars/dist/handlebars.js',
			},
			// Handlebars' Node build references `fs`/`util`; stub them for the browser.
			fallback: {
				fs: false,
				util: false,
			},
		},
	});
};

export default config;
