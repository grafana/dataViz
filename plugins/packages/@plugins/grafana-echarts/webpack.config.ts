// Root webpack config that extends the scaffolded `.config` webpack config
// (which must not be edited). See:
// https://grafana.com/developers/plugin-tools/how-to-guides/extend-configurations#extend-the-webpack-config
//
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import fs from 'fs';
import path from 'path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import webpack, { type ChunkGraph, type Configuration, type Module } from 'webpack';
import LiveReloadPlugin from 'webpack-livereload-plugin';
// https://github.com/webpack-contrib/webpack-bundle-analyzer
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import VirtualModulesPlugin from 'webpack-virtual-modules';

import { copyFilePatterns } from './/.config/bundler/copyFiles.ts';
import { DIST_DIR } from './/.config/bundler/constants.ts';
import baseConfig, { type Env } from './/.config/webpack/webpack.config.ts';

type PluginManifest = {
  id: string;
  info?: {
    logos?: {
      large?: string;
      small?: string;
    };
    screenshots?: Array<{ path: string }>;
  };
};

type PackageMetadata = {
  version: string;
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const standalonePluginKinds = [
  { name: 'BannerPlugin', matches: (plugin: unknown) => plugin instanceof webpack.BannerPlugin },
  { name: 'CopyWebpackPlugin', matches: (plugin: unknown) => plugin instanceof CopyWebpackPlugin },
  {
    name: 'ReplaceInFileWebpackPlugin',
    matches: (plugin: unknown) => plugin instanceof ReplaceInFileWebpackPlugin,
  },
  { name: 'VirtualModulesPlugin', matches: (plugin: unknown) => plugin instanceof VirtualModulesPlugin },
];

// What the app build leaves out of src/modules/relations: the panel's own
// package.json (its version source), and dist/, which the relations
// `build` script writes there when plugin-ci-workflows' cd.yml builds the
// standalone panel from that directory. The scaffold would otherwise copy
// both, and bundle dist/module.js as one more nested plugin.
const relationsStandaloneFiles = ['modules/relations/package.json', 'modules/relations/dist/**'];

const appPlugins = (
  plugins: NonNullable<Configuration['plugins']>,
  manifest: PluginManifest,
  packageVersion: string,
  distDir: string
): NonNullable<Configuration['plugins']> => [
  // The scaffold's ReplaceInFileWebpackPlugin reads only `dist`, so another output directory needs its own.
  ...plugins.filter(
    (plugin) =>
      !(plugin instanceof CopyWebpackPlugin) && !(distDir !== DIST_DIR && plugin instanceof ReplaceInFileWebpackPlugin)
  ),
  new CopyWebpackPlugin({
    patterns: [
      ...copyFilePatterns.map((pattern) => ({ ...pattern, globOptions: { ignore: relationsStandaloneFiles } })),
      // Nested manifests reference logos that the scaffold copy step omits.
      { from: 'modules/*/img/**', to: '[path][name][ext]', noErrorOnMissing: true },
    ],
  }),
  ...(distDir === DIST_DIR ? [] : [templateVariablesPlugin(manifest, packageVersion, distDir)]),
];

// The scaffold's template-variable step, for an output directory other than `dist`.
const templateVariablesPlugin = (manifest: PluginManifest, packageVersion: string, distDir: string) =>
  new ReplaceInFileWebpackPlugin([
    {
      dir: distDir,
      test: [/(^|\/)plugin\.json$/, /(^|\/)README\.md$/],
      rules: [
        { search: /\%VERSION\%/g, replace: packageVersion },
        { search: /\%TODAY\%/g, replace: new Date().toISOString().substring(0, 10) },
        { search: /\%PLUGIN_ID\%/g, replace: manifest.id },
      ],
    },
  ]);

const appEntries = (entries: Record<string, string>): Record<string, string> => {
  const relationsDist = path.resolve(process.cwd(), 'src/modules/relations/dist');
  return Object.fromEntries(Object.entries(entries).filter(([, modulePath]) => !modulePath.startsWith(relationsDist)));
};

const standaloneCopyPatterns = (manifest: PluginManifest) => {
  const moduleDirectory = 'modules/relations';
  const assetPaths = Array.from(
    new Set([
      manifest.info?.logos?.small,
      manifest.info?.logos?.large,
      ...(manifest.info?.screenshots?.map(({ path: screenshotPath }) => screenshotPath) ?? []),
    ])
  ).filter((assetPath): assetPath is string => Boolean(assetPath));

  for (const assetPath of assetPaths) {
    const sourcePath = path.resolve(process.cwd(), 'src', moduleDirectory, assetPath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Relations manifest asset does not exist: ${assetPath}`);
    }
  }

  return [
    { from: `${moduleDirectory}/plugin.json`, to: 'plugin.json' },
    ...assetPaths.map((assetPath) => ({ from: `${moduleDirectory}/${assetPath}`, to: assetPath })),
    { from: 'README.md', to: '.', force: true },
    { from: `${moduleDirectory}/CHANGELOG.md`, to: '.', force: true },
    { from: '../LICENSE', to: '.' },
  ];
};

// The scaffold's watch-only plugins. The app build of `pnpm run dev` already runs them,
// and a second LiveReloadPlugin cannot bind the same port.
const watchOnlyPlugins = [LiveReloadPlugin, ForkTsCheckerWebpackPlugin, ESLintPlugin];

const replaceStandalonePlugins = (
  plugins: NonNullable<Configuration['plugins']>,
  manifest: PluginManifest,
  packageVersion: string,
  isWatchCompanion: boolean
): NonNullable<Configuration['plugins']> => {
  for (const pluginKind of standalonePluginKinds) {
    const count = plugins.filter(pluginKind.matches).length;
    if (count !== 1) {
      throw new Error(`Expected one scaffold ${pluginKind.name}, found ${count}.`);
    }
  }

  const retainedPlugins = plugins.filter(
    (plugin) =>
      !standalonePluginKinds.some((pluginKind) => pluginKind.matches(plugin)) &&
      !(isWatchCompanion && watchOnlyPlugins.some((pluginType) => plugin instanceof pluginType))
  );
  const virtualPublicPath = new VirtualModulesPlugin({
    'node_modules/grafana-public-path.js': `
import amdMetaModule from 'amd-module';

__webpack_public_path__ =
  amdMetaModule && amdMetaModule.uri
    ? amdMetaModule.uri.slice(0, amdMetaModule.uri.lastIndexOf('/') + 1)
    : 'public/plugins/${manifest.id}/';
`,
  });

  return [
    ...retainedPlugins,
    virtualPublicPath,
    new webpack.BannerPlugin({
      banner: `/* [create-plugin] plugin: ${manifest.id}@${packageVersion} */`,
      raw: true,
      entryOnly: true,
    }),
    new CopyWebpackPlugin({ patterns: standaloneCopyPatterns(manifest) }),
    templateVariablesPlugin(manifest, packageVersion, DIST_DIR),
  ];
};

const ECHARTS_MODULE = /[\\/]node_modules[\\/](\.pnpm[\\/].*[\\/])?(echarts|zrender)[\\/]/;
/** The `webpackChunkName` of the basemap import in `src/modules/geo/module.tsx`. */
export const GEO_BASEMAP_CHUNK = 'geo-basemap';

// `pnpm run dev` (`--env withRelations`) also watches the standalone relations panel. The panel writes `dist`,
// as `build:relations` does, so one relations stack serves either build. The app moves to its own directory.
const APP_DEV_DIST_DIR = 'dist-app';

const pluginConfig = async (env: Env): Promise<Configuration> => {
  if (env.standalone !== undefined && env.standalone !== 'relations') {
    throw new Error(`Unsupported standalone target "${String(env.standalone)}". Supported targets: relations.`);
  }

  const base = await baseConfig(env);
  const isRelationsStandalone = env.standalone === 'relations';
  const isWatchCompanion = isRelationsStandalone && Boolean(env.withRelations);
  const appDistDir = env.withRelations ? APP_DEV_DIST_DIR : DIST_DIR;
  const rootManifest = readJson<PluginManifest>(path.resolve(process.cwd(), 'src/plugin.json'));
  const relationsManifest = readJson<PluginManifest>(path.resolve(process.cwd(), 'src/modules/relations/plugin.json'));
  // The standalone panel is released on its own, so its version comes from its
  // own package.json, not the echarts package's (see .github/actions/RELEASES.md).
  const relationsPackage = readJson<PackageMetadata>(path.resolve(process.cwd(), 'src/modules/relations/package.json'));
  const packageVersion = readJson<PackageMetadata>(path.resolve(process.cwd(), 'package.json')).version;
  const activePluginId = isRelationsStandalone ? relationsManifest.id : rootManifest.id;

  if (isRelationsStandalone) {
    base.entry = {
      module: path.resolve(process.cwd(), 'src/modules/relations/module.tsx'),
    };
    base.output = {
      ...base.output,
      publicPath: `public/plugins/${relationsManifest.id}/`,
      uniqueName: relationsManifest.id,
    };
  } else {
    base.entry = appEntries(base.entry as Record<string, string>);
    base.output = { ...base.output, path: path.resolve(process.cwd(), appDistDir) };
  }

  // De-duplicate the ECharts runtime across the nested panel entries. Each
  // panel registers a React.lazy wrapper (see lib/components/LazyPanel), so the
  // Panel and its ECharts import only ever live in async chunks; this cacheGroup
  // collapses the ECharts/zrender modules shared by those async chunks into a
  // single `echarts` chunk emitted once (the shared Panel code is likewise
  // de-duplicated by webpack's default async cacheGroup).
  //
  // Only `async` chunks are split: Grafana's plugin loader fetches just each
  // entry `module.js`, and webpack's runtime lazy-loads async chunks via the
  // dynamic publicPath. Splitting `initial` chunks would instead emit sibling
  // chunks that Grafana never loads, leaving the panel factory waiting forever.
  base.optimization = {
    ...base.optimization,
    splitChunks: {
      chunks: 'async',
      cacheGroups: {
        echarts: {
          // An ECharts module that only the geo basemap chunk uses stays out, for example `GeoComponent`.
          // Thus the other panels do not load it. https://webpack.js.org/plugins/split-chunks-plugin/#splitchunkscachegroupscachegrouptest
          test: (module: Module, { chunkGraph }: { chunkGraph: ChunkGraph }) =>
            ECHARTS_MODULE.test(module.nameForCondition() ?? '') &&
            [...chunkGraph.getModuleChunksIterable(module)].some((chunk) => chunk.name !== GEO_BASEMAP_CHUNK),
          name: 'echarts',
          chunks: 'async',
          enforce: true,
        },
      },
    },
  };

  const configuredPlugins = isRelationsStandalone
    ? replaceStandalonePlugins(base.plugins ?? [], relationsManifest, relationsPackage.version, isWatchCompanion)
    : appPlugins(base.plugins ?? [], rootManifest, packageVersion, appDistDir);

  base.plugins = [
    ...configuredPlugins,
    new webpack.DefinePlugin({
      __PLUGIN_ID__: JSON.stringify(activePluginId),
    }),
    // Enabled via `pnpm run build:analyze` (passes `--env analyze`). Writes a
    // static report so the build stays non-interactive and CI-friendly.
    ...(env.analyze ? [new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false })] : []),
  ];

  return base;
};

// https://webpack.js.org/configuration/configuration-types/#exporting-multiple-configurations
const config = async (env: Env): Promise<Configuration | Configuration[]> => {
  if (!env.withRelations || env.standalone !== undefined) {
    return pluginConfig(env);
  }
  return Promise.all([pluginConfig(env), pluginConfig({ ...env, standalone: 'relations' })]);
};

export default config;
