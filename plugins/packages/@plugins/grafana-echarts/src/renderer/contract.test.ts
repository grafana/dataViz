// Checks that the contract copy in `contract/` and the panels of this package agree.
import fs from 'node:fs';
import path from 'node:path';
import chartTypes from './contract/registry/chart-types.json';
import panelTypes from './contract/registry/panel-types.json';

const fixturesDir = path.join(__dirname, 'contract', 'fixtures');
const sets = fs.readdirSync(fixturesDir).filter((name) => fs.statSync(path.join(fixturesDir, name)).isDirectory());
const smokeSets = sets.filter((name) => name.startsWith('smoke-')).sort();

const modulesDir = path.join(__dirname, '..', 'modules');
const pluginIds = fs
  .readdirSync(modulesDir)
  .filter((name) => fs.existsSync(path.join(modulesDir, name, 'plugin.json')))
  .map((name) => JSON.parse(fs.readFileSync(path.join(modulesDir, name, 'plugin.json'), 'utf8')).id)
  .sort();

describe('contract copy', () => {
  // contract-rule: fixtures.5
  it('has one smoke set for each chart type, and no other smoke set', () => {
    expect(smokeSets).toEqual(chartTypes.charts.map((chart) => `smoke-${chart.name}`).sort());
  });

  // contract-rule: fixtures.10
  it('has spec.json and state.json in each set', () => {
    for (const set of sets) {
      expect([set, fs.existsSync(path.join(fixturesDir, set, 'spec.json'))]).toEqual([set, true]);
      expect([set, fs.existsSync(path.join(fixturesDir, set, 'state.json'))]).toEqual([set, true]);
    }
  });

  // contract-rule: fixtures.10
  it('has no expected.png, because the Renderer has no image test yet', () => {
    // When a set has expected.png, add the image test of fixtures.10, then remove this test.
    expect(sets.filter((set) => fs.existsSync(path.join(fixturesDir, set, 'expected.png')))).toEqual([]);
  });

  // contract-rule: fixtures.12
  it('has one error set for each error that the spec checks give', () => {
    const errorSets = sets.filter((name) => name.startsWith('error-')).sort();
    expect(errorSets).toEqual(
      ['invalid-spec', 'unsupported-spec-version', 'unsupported-panel-type', 'all-queries-failed']
        .map((code) => `error-${code}`)
        .sort()
    );
  });

  it('names a panel type of panel-types.json for each chart type', () => {
    const ids = new Set(panelTypes.panels.map((panel) => panel.id));
    expect(chartTypes.charts.filter((chart) => !ids.has(chart.panel))).toEqual([]);
  });

  it('has one panel of this package for each panel type', () => {
    expect(panelTypes.panels.map((panel) => panel.id).sort()).toEqual(pluginIds);
  });
});
