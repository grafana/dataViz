import { config } from '@grafana/runtime';

import { generateHtml } from './html';

/**
 * These tests exercise the real rendering path (Handlebars -> markdown-it with
 * `html: true` -> textUtil.sanitize) with NO mock on `textUtil.sanitize`, to
 * guarantee that hazardous, user-authored HTML is neutralized before it can
 * reach the DOM (Frontend Security rules F1/F3/F6). Unlike html.test.tsx, this
 * suite deliberately does not stub the sanitizer.
 */
describe('generateHtml sanitization', () => {
	const baseParams = {
		data: {},
		helpers: '',
		timeRange: {} as never,
		timeZone: '' as never,
		replaceVariables: ((str: string) => str) as never,
		eventBus: {} as never,
		options: { wrap: true } as never,
		panelData: {} as never,
		notifySuccess: () => undefined,
		notifyError: () => undefined,
		theme: {} as never,
		partials: [],
		refreshDashboard: () => undefined,
		getUserPreference: async () => undefined,
		setUserPreference: async <T,>(_key: string, value: T) => value,
	};

	const render = (content: string) => generateHtml({ ...baseParams, content });

	it('Should strip <script> tags', async () => {
		const { html } = await render('<script>alert(1)</script>');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('alert(1)');
	});

	it('Should strip <iframe> tags', async () => {
		const { html } = await render('<iframe src="https://evil.example"></iframe>');
		expect(html).not.toContain('<iframe');
	});

	it('Should strip inline event handler attributes', async () => {
		const { html } = await render('<img src="x" onerror="alert(1)">');
		expect(html).not.toContain('onerror');
		expect(html).not.toContain('alert(1)');
	});

	it('Should strip on* handlers from block elements', async () => {
		const { html } = await render('<div onclick="alert(1)">hi</div>');
		expect(html).not.toContain('onclick');
		expect(html).toContain('hi');
	});

	it('Should neutralize javascript: URLs', async () => {
		const { html } = await render('<a href="javascript:alert(1)">x</a>');
		expect(html).not.toContain('javascript:');
	});

	it('Should strip <svg> with onload', async () => {
		const { html } = await render('<svg onload="alert(1)"></svg>');
		expect(html).not.toContain('onload');
		expect(html).not.toContain('<svg');
	});

	it('Should pass raw HTML through when sanitization is disabled in Grafana', async () => {
		config.disableSanitizeHtml = true;
		try {
			const { html } = await render('<script>alert(1)</script>');
			// This documents the operator-controlled trust boundary: when an admin
			// sets disableSanitizeHtml, content is intentionally NOT sanitized.
			expect(html).toContain('<script>alert(1)</script>');
		} finally {
			config.disableSanitizeHtml = false;
		}
	});
});
