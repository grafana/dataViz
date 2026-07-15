import type { PanelModel } from '@grafana/data';
import { describe, expect, it } from 'vitest';
import { canvasMigrationHandler } from './migrations';

function makePanel(pluginVersion: string, options: Record<string, unknown>): PanelModel {
	return { pluginVersion, options } as unknown as PanelModel;
}

describe('canvasMigrationHandler', () => {
	it('renames text-box elements to rectangle on the initial (empty version) migration', () => {
		const panel = makePanel('', {
			root: { elements: [{ type: 'text-box' }, { type: 'icon' }] },
		});

		const result = canvasMigrationHandler(panel);

		// biome-ignore lint/suspicious/noExplicitAny: test asserts on migrated shape
		const elements = (result as any).root.elements as Array<{ type: string }>;
		expect(elements[0].type).toBe('rectangle');
		expect(elements[1].type).toBe('icon');
	});

	it('normalizes connection direction to the object form for versions <= 12.2', () => {
		const panel = makePanel('12.2.0', {
			root: {
				elements: [
					{
						type: 'rectangle',
						connections: [{ direction: 'reverse' }, {}],
					},
				],
			},
		});

		const result = canvasMigrationHandler(panel);

		// biome-ignore lint/suspicious/noExplicitAny: test asserts on migrated shape
		const connections = (result as any).root.elements[0].connections as Array<{
			direction: { mode: string; fixed: string };
		}>;
		expect(connections[0].direction).toEqual({ mode: 'fixed', fixed: 'reverse' });
		expect(connections[1].direction).toEqual({ mode: 'fixed', fixed: 'forward' });
	});

	it('returns options unchanged when there is no root', () => {
		const panel = makePanel('12.3.0', {});
		expect(canvasMigrationHandler(panel)).toEqual({});
	});
});
