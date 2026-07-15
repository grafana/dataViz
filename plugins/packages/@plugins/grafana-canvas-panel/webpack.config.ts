import CopyWebpackPlugin from 'copy-webpack-plugin';
import webpack, { type Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import { type Env, monorepoConfig } from '../../../.shared/webpack-monorepo.ts';
import packageJson from './package.json' with { type: 'json' };

// Layer 3 of the build-config chain: per-package overrides merged on top of the
// monorepo layer (`plugins/.shared/webpack-monorepo.ts`), which itself sits on
// the verbatim create-plugin base (`plugins/.config/webpack/webpack.config.ts`).
// Entry, plugin.json resolution, README/CHANGELOG/LICENSE/JSON copy and template
// replacement are all handled by the lower layers; only genuinely package-specific
// concerns belong here.
//
// Canvas ships a large bundled asset tree under `src/img/` (unicons SVGs + bg
// PNGs) that is referenced by URL at runtime rather than imported, so the base
// copy rules (logos + `**/*.json` only) do not cover it. Mirror upstream's
// `CopyWebpackPlugin({ from: 'img', to: 'img' })` to emit `dist/img/**`.

const PLUGIN_ID = 'grafana-canvas-panel';

const config = async (env: Env): Promise<Configuration> => {
	const base = await monorepoConfig(env);

	return merge(base, {
		plugins: [
			new webpack.EnvironmentPlugin({
				NODE_ENV: env.development ? 'development' : 'production',
				PLUGIN_ID,
				CURRENT_VERSION: packageJson.version,
			}),
			new CopyWebpackPlugin({
				patterns: [{ from: 'img', to: 'img' }],
			}),
		],
	});
};

export default config;
