const fs = require('fs');
const path = require('path');

const config = require('../../webpack.config').default;

const pluginsNamed = (plugins, name) => plugins.filter((plugin) => plugin?.constructor.name === name);

// Reads every file as usual, except the Relations package.json, which gets a
// version the echarts package.json does not have.
const withRelationsVersion = (version) => {
  const relationsPackagePath = path.resolve(process.cwd(), 'src/modules/relations/package.json');
  const readFileSync = fs.readFileSync;
  return jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...options) => {
    if (filePath === relationsPackagePath) {
      return JSON.stringify({ name: 'grafana-relations-panel', version });
    }
    return readFileSync(filePath, ...options);
  });
};

describe('webpack configuration', () => {
  it('builds the Relations panel as the only standalone entry', async () => {
    const standalone = await config({ production: true, standalone: 'relations' });

    expect(standalone.entry).toEqual({
      module: path.resolve(process.cwd(), 'src/modules/relations/module.tsx'),
    });
    expect(standalone.output).toEqual(
      expect.objectContaining({
        filename: '[name].js',
        publicPath: 'public/plugins/grafana-relations-panel/',
        uniqueName: 'grafana-relations-panel',
      })
    );
  });

  it('rejects unsupported standalone targets', async () => {
    await expect(config({ production: true, standalone: 'unknown' })).rejects.toThrow(
      'Unsupported standalone target "unknown". Supported targets: relations.'
    );
  });

  it('keeps all discovered entries in the default build', async () => {
    const defaultConfig = await config({ production: true });

    expect(Object.keys(defaultConfig.entry).sort()).toEqual([
      'module',
      'modules/cartesian/module',
      'modules/geo/module',
      'modules/heatmap/module',
      'modules/hierarchy/module',
      'modules/multivariate/module',
      'modules/part-to-whole/module',
      'modules/relations/module',
      'modules/state-timeline/module',
      'modules/status-history/module',
      'modules/stream/module',
    ]);
    expect(defaultConfig.output).toEqual(
      expect.objectContaining({
        publicPath: 'public/plugins/grafana-echarts-app/',
        uniqueName: 'grafana-echarts-app',
      })
    );
  });

  it('copies only Relations release files in standalone mode', async () => {
    const standalone = await config({ production: true, standalone: 'relations' });
    const copyPlugins = pluginsNamed(standalone.plugins ?? [], 'CopyPlugin');

    expect(copyPlugins).toHaveLength(1);
    expect(copyPlugins[0]).toEqual(
      expect.objectContaining({
        patterns: [
          { from: 'modules/relations/plugin.json', to: 'plugin.json' },
          { from: 'modules/relations/img/logo.svg', to: 'img/logo.svg' },
          { from: 'modules/relations/img/relations-presets.png', to: 'img/relations-presets.png' },
          { from: 'modules/relations/img/relations-timeline.png', to: 'img/relations-timeline.png' },
          { from: 'README.md', to: '.', force: true },
          { from: 'modules/relations/CHANGELOG.md', to: '.', force: true },
          { from: '../LICENSE', to: '.' },
        ],
      })
    );
  });

  it('versions the standalone Relations build from its own package.json', async () => {
    const readFileSpy = withRelationsVersion('9.8.7');
    try {
      const standalone = await config({ production: true, standalone: 'relations' });
      const [banner] = pluginsNamed(standalone.plugins ?? [], 'BannerPlugin');
      const [replaceInFile] = pluginsNamed(standalone.plugins ?? [], 'ReplaceInFilePlugin');
      const versionRule = replaceInFile.options[0].rules.find((rule) => '%VERSION%'.match(rule.search));

      expect(banner.options.banner).toBe('/* [create-plugin] plugin: grafana-relations-panel@9.8.7 */');
      expect(versionRule.replace).toBe('9.8.7');
    } finally {
      readFileSpy.mockRestore();
    }
  });

  it('leaves the standalone Relations files out of the app build', async () => {
    // The entry that the scaffold discovers when the Relations `build` script left dist/ behind
    // (cd.yml builds the panel from its directory). Mocked, so the test never writes to that directory.
    const relationsDistModule = path.resolve(process.cwd(), 'src/modules/relations/dist/module.js');
    let isolatedConfig;
    jest.isolateModules(() => {
      jest.doMock('../../.config/bundler/utils.ts', () => {
        const actual = jest.requireActual('../../.config/bundler/utils.ts');
        return {
          ...actual,
          getEntries: async () => ({
            ...(await actual.getEntries()),
            'modules/relations/dist/module': relationsDistModule,
          }),
        };
      });
      isolatedConfig = require('../../webpack.config').default;
    });

    const defaultConfig = await isolatedConfig({ production: true });
    const [copyPlugin] = pluginsNamed(defaultConfig.plugins ?? [], 'CopyPlugin');
    const jsonPattern = copyPlugin.patterns.find((pattern) => pattern.from === '**/*.json');

    expect(Object.values(defaultConfig.entry)).not.toContain(relationsDistModule);
    expect(Object.keys(defaultConfig.entry)).toContain('modules/relations/module');
    expect(jsonPattern.globOptions.ignore).toEqual(['modules/relations/package.json', 'modules/relations/dist/**']);
  });

  // The echarts chunk is loaded by each panel. An ECharts module that only the geo basemap chunk uses stays out.
  it('keeps the ECharts modules that only the geo basemap uses out of the echarts chunk', async () => {
    const { GEO_BASEMAP_CHUNK } = require('../../webpack.config');
    const defaultConfig = await config({ production: true });
    const test = defaultConfig.optimization.splitChunks.cacheGroups.echarts.test;
    const echartsModule = { nameForCondition: () => '/x/node_modules/echarts/lib/coord/geo/Geo.js' };
    const ownModule = { nameForCondition: () => '/x/src/lib/echarts/geo/basemap.ts' };
    const usedBy = (...names) => ({ chunkGraph: { getModuleChunksIterable: () => names.map((name) => ({ name })) } });

    expect(test(echartsModule, usedBy(GEO_BASEMAP_CHUNK))).toBe(false);
    expect(test(echartsModule, usedBy(GEO_BASEMAP_CHUNK, undefined))).toBe(true);
    expect(test(echartsModule, usedBy(undefined))).toBe(true);
    expect(test(ownModule, usedBy(undefined))).toBe(false);
    // The chunk name of the basemap import must be the name that the test skips.
    const geoModule = require('fs').readFileSync(path.resolve(__dirname, '../modules/geo/module.tsx'), 'utf8');
    expect(geoModule).toContain(`webpackChunkName: "${GEO_BASEMAP_CHUNK}"`);
  });
});
