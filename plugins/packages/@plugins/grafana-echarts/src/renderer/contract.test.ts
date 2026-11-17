// Checks that the installed viz contract (`@grafana/viz-contract`) and the panels of this package agree.
import chartTypes from '@grafana/viz-contract/registry/chart-types.json';
import panelTypes from '@grafana/viz-contract/registry/panel-types.json';
import fs from 'node:fs';
import path from 'node:path';
import { allFixtureSets, FIXTURES_DIR, fixtureSets } from 'test/rendererFixtures';

const sets = fixtureSets();
const smokeSets = sets.filter((name) => name.startsWith('smoke-'));

const modulesDir = path.join(__dirname, '..', 'modules');
const pluginIds = fs
  .readdirSync(modulesDir)
  .filter((name) => fs.existsSync(path.join(modulesDir, name, 'plugin.json')))
  .map((name) => JSON.parse(fs.readFileSync(path.join(modulesDir, name, 'plugin.json'), 'utf8')).id)
  .sort();

/**
 * The panels of this package that are in the app but not in the installed viz contract yet. The Renderer does
 * not draw them. A panel leaves this list when a contract release has its row in `panel-types.json`.
 */
const NOT_IN_CONTRACT_YET = ['grafana-echartsstat-panel'];

describe('viz contract', () => {
  // contract-rule: fixtures.5
  it('has one smoke set for each chart type, and no other smoke set', () => {
    expect(smokeSets).toEqual(chartTypes.charts.map((chart) => `smoke-${chart.name}`).sort());
  });

  // contract-rule: fixtures.10
  it('has spec.json in each Renderer set', () => {
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.filter((set) => !fs.existsSync(path.join(FIXTURES_DIR, set, 'spec.json')))).toEqual([]);
  });

  // contract-rule: fixtures.10
  it('has no smoke or error set that is not a Renderer set', () => {
    const others = allFixtureSets().filter((set) => !sets.includes(set));
    expect(others.filter((set) => set.startsWith('smoke-') || set.startsWith('error-'))).toEqual([]);
  });

  // contract-rule: fixtures.12
  it('has one error set for each error that the spec checks give', () => {
    const errorSets = sets.filter((name) => name.startsWith('error-'));
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
    const contractIds = panelTypes.panels.map((panel) => panel.id);
    expect(contractIds.sort()).toEqual(pluginIds.filter((id) => !NOT_IN_CONTRACT_YET.includes(id)));
  });

  // When the contract gets the panel type, this test fails: remove the id from the list, and add the panel to
  // `src/renderer/panels.ts`.
  it('has no panel type of the contract in the list of panels that the contract does not have yet', () => {
    const contractIds = panelTypes.panels.map((panel) => panel.id);
    expect(NOT_IN_CONTRACT_YET.filter((id) => contractIds.includes(id))).toEqual([]);
    expect(NOT_IN_CONTRACT_YET.filter((id) => !pluginIds.includes(id))).toEqual([]);
  });
});
