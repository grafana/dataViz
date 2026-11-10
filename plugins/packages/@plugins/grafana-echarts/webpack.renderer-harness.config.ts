// Webpack config of the test App of the Renderer sandbox test (`scripts/renderer-harness/app.mjs`). Not shipped.
// It stands in for the App build of mcp-grafana, which uses Vite and `vite-plugin-singlefile`, not webpack, and does not
// bundle the Renderer yet. It bundles the contract peers with the built Renderer, as `delivery.1` says. The minified
// output of the real App build can differ: escaping, CSS injection, and the `eval` check of `@grafana/data`.
import fs from 'fs';
import path from 'path';
import { type Configuration } from 'webpack';

/** The real folder of `@grafana/ui`. pnpm puts its dependencies in the `node_modules` folder above it. */
const realUiDir = () => fs.realpathSync(path.dirname(require.resolve('@grafana/ui/package.json')));

const config = (): Configuration => ({
  mode: 'production',
  entry: path.resolve(process.cwd(), 'scripts/renderer-harness/app.mjs'),
  target: 'web',
  module: {
    rules: [
      // `@grafana/ui` imports CSS. `style-loader` adds it as `<style>`, which `style-src 'unsafe-inline'` allows.
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  output: {
    path: path.resolve(process.cwd(), 'dist-renderer-harness'),
    filename: 'app.js',
    publicPath: '',
    asyncChunks: false,
    clean: true,
  },
  optimization: { splitChunks: false },
  performance: { hints: false },
  resolve: {
    extensions: ['.js', '.mjs'],
    // The App fills the icon cache of the `react-inlinesvg` that its `@grafana/ui` imports (`renderer.15`). This
    // package has no dependency on it, so resolve it from the folder of `@grafana/ui`: the same copy, not a second one.
    modules: ['node_modules', path.dirname(path.dirname(realUiDir()))],
  },
});

export default config;
