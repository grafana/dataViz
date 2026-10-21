import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildRelationsPane } from 'test/relationsPane';

/**
 * **Each relations option that changes the drawing has a render test for a changed value.**
 *
 * `docs/relations-canvas-coverage.md` records the coverage of each option. This test reads the options from the
 * options pane and makes sure that each one has a row, and that the "Changed render" column of the row names a
 * render test (■ or ▫) or `n/a`. A new option without a render test fails here.
 */
const COVERAGE_DOC = path.join(__dirname, '../../docs/relations-canvas-coverage.md');

/** Pane sections that change the drawing. Legend, Tooltip and Performance have their own suites. */
const RENDER_SECTIONS = new Set(['Value', 'Labels', 'Layout', 'Interaction', 'Edges', 'Sankey', 'Chord']);

/** Options without a changed render, and the reason. Remove an entry when its test is added. */
const KNOWN_GAPS: Record<string, string> = {
  relationsLayoutAnimation: 'Needs a canvas snapshot at one frame of the animation.',
  relationsChordLinkOpacity: 'Needs a canvas snapshot in the chord suite.',
};

/** The "Changed render" cell of each option row, by option name. A row can name more than one option. */
function readChangedCells(): Map<string, string> {
  const cells = new Map<string, string>();
  for (const line of readFileSync(COVERAGE_DOC, 'utf8').split('\n')) {
    const columns = line.split('|').map((column) => column.trim());
    // | option | default | base render | changed render |
    if (columns.length !== 6 || !columns[1].startsWith('`')) {
      continue;
    }
    for (const [, name] of columns[1].matchAll(/`([^`]+)`/g)) {
      cells.set(name, columns[4]);
    }
  }
  return cells;
}

describe('relations render coverage', () => {
  const options = [
    ...new Set(
      buildRelationsPane()
        .filter((item) => RENDER_SECTIONS.has(item.category?.[0] ?? ''))
        .map((item) => item.path)
    ),
  ];
  const cells = readChangedCells();

  it('finds the options and the coverage rows', () => {
    expect(options.length).toBeGreaterThan(20);
    expect(cells.size).toBeGreaterThan(20);
  });

  it.each(options)('%s has a row in the coverage document', (option) => {
    expect(cells.has(option)).toBe(true);
  });

  it.each(options.filter((option) => !(option in KNOWN_GAPS)))('%s has a changed render test', (option) => {
    expect(cells.get(option)).toMatch(/^(■|▫|n\/a)/);
  });

  it.each(Object.keys(KNOWN_GAPS))('%s is still a gap (remove it from KNOWN_GAPS)', (option) => {
    expect(cells.get(option)).toMatch(/^·/);
  });
});
