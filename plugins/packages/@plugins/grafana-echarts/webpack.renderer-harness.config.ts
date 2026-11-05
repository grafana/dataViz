// Webpack config of the test App of the Renderer sandbox test (`scripts/renderer-harness/app.mjs`). Not shipped.
// It bundles the contract peers with the built Renderer, as the App of mcp-grafana does (`delivery.1`).
import path from 'path';
import { type Configuration } from 'webpack';

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
  resolve: { extensions: ['.js', '.mjs'] },
});

export default config;
