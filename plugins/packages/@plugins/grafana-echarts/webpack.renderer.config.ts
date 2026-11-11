// Webpack config of the Renderer bundle: one ES module for the viz contract (docs/renderer.md).
// It does not extend `.config/webpack`: that config makes an AMD plugin bundle with async chunks.
// https://webpack.js.org/configuration/output/#outputlibrarytype
import fs from 'fs';
import path from 'path';
import webpack, { type Configuration } from 'webpack';

/** The contract peers (`renderer.9`). The App gives them, so they stay bare `import` specifiers. */
export const PEER = /^(react|react-dom)(\/.*)?$|^@grafana\/(ui|data)(\/.*)?$|^@emotion\//;

/** The output directory. `scripts/renderer-manifest.mjs` has the same path in `DIST_DIR`. */
export const RENDERER_DIST_DIR = 'dist-renderer';

// The Renderer `version` is the package version, until the Renderer has its own package.
const packageVersion: string = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')).version;

const config = (env: { development?: boolean }): Configuration => ({
  mode: env.development ? 'development' : 'production',
  devtool: env.development ? 'source-map' : false,
  entry: path.resolve(process.cwd(), 'src/renderer/index.ts'),
  target: 'web',
  experiments: { outputModule: true },
  externalsType: 'module',
  externals: [({ request }, callback) => (request && PEER.test(request) ? callback(undefined, request) : callback())],
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.[tj]sx?$/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              baseUrl: path.resolve(process.cwd(), 'src'),
              target: 'es2020',
              parser: { syntax: 'typescript', tsx: true, dynamicImport: true },
            },
          },
        },
      },
    ],
  },
  output: {
    path: path.resolve(process.cwd(), RENDERER_DIST_DIR),
    filename: 'renderer.js',
    library: { type: 'module' },
    // `auto` reads `import.meta.url`, which is `about:srcdoc` in the sandbox iframe. Nothing loads by URL.
    publicPath: '',
    // A sandbox iframe with no `allow-same-origin` cannot load a chunk (`renderer.7`), so inline each `import()`.
    // https://webpack.js.org/configuration/output/#outputasyncchunks
    asyncChunks: false,
    clean: true,
  },
  optimization: { splitChunks: false },
  performance: { hints: false },
  plugins: [
    new webpack.DefinePlugin({
      // The i18n namespace of the modules and the `lib/publicPath` side effect read it.
      __PLUGIN_ID__: JSON.stringify('grafana-echarts-app'),
      __RENDERER_VERSION__: JSON.stringify(packageVersion),
    }),
    // `asyncChunks: false` covers `import()`. This makes sure that no other split adds a file.
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    // The same root as `.config/webpack`, so `lib/…`, `editor/…`, `modules/…` and `types` resolve.
    modules: [path.resolve(process.cwd(), 'src'), 'node_modules'],
  },
});

export default config;
