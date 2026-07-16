import { textUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { render, screen } from '@testing-library/react';
import Handlebars from 'handlebars';
import { fetchAllPartials } from './partials';
import { generateHtml } from './html';

/**
 * Mock handlebars
 */
vi.mock('handlebars', () => {
	// Share one object across the default and named exports so assertions on the
	// default `Handlebars` import observe calls made through either import shape.
	const handlebarsMock = {
		registerHelper: vi.fn(),
		registerPartial: vi.fn(),
		compile: vi.fn((str: string) => () => str),
		partials: {},
	};
	return { default: handlebarsMock, ...handlebarsMock };
});

vi.mock('./partials', () => ({
	fetchAllPartials: vi.fn(),
}));

/**
 * Mock @grafana/runtime
 */
vi.mock('@grafana/runtime', async () => ({
	...(await vi.importActual('@grafana/runtime')),
	config: {
		disableSanitizeHtml: false,
	},
}));

/**
 * Mock @grafana/data
 */
vi.mock('@grafana/data', async () => ({
	...(await vi.importActual('@grafana/data')),
	textUtil: {
		sanitize: vi.fn((str) => str),
	},
}));

describe('HTML helpers', () => {
	/**
	 * Options
	 */
	const options = {
		wrap: true,
	};

	describe('Generate HTML', () => {
		beforeEach(() => {
			vi.mocked(textUtil.sanitize).mockClear();
		});

		it('Should sanitize html', () => {
			const content = '<div></div>';

			generateHtml({
				content,
				options,
				htmlContents: [],
			} as any);

			expect(textUtil.sanitize).toHaveBeenCalledWith(content);
		});

		it('Should wrap lines', async () => {
			const content = `
        line 1
        
        line 2
      `;

			const { html } = await generateHtml({
				content,
				options,
				htmlContents: [],
			} as any);

			render(<div data-testid="root" dangerouslySetInnerHTML={{ __html: html }} />);

			expect(screen.getByTestId('root').querySelector('pre')).toBeInTheDocument();
		});

		it('Should not wrap lines', async () => {
			const content = `
        line 1
        
        line 2

        {{> aaaa }}
      `;

			const { html } = await generateHtml({
				content,
				options: {
					...options,
					wrap: false,
				},
				htmlContents: [{ name: 'aaaa', content: '<p>test<p>' }],
			} as any);

			render(<div data-testid="root" dangerouslySetInnerHTML={{ __html: html }} />);

			expect(screen.getByTestId('root').querySelector('pre')).not.toBeInTheDocument();
		});

		it('Should not sanitize html if disabled', () => {
			const content = '<div></div>';

			/**
			 * Disable sanitizing
			 */
			config.disableSanitizeHtml = true;

			generateHtml({
				content,
				options,
				htmlContents: [],
			} as any);

			expect(textUtil.sanitize).not.toHaveBeenCalled();

			/**
			 * Return default value
			 */
			config.disableSanitizeHtml = false;
		});
	});

	it('Should use variable handler', () => {
		let variableHandler: any;
		let variableValueHandler: any;

		vi.mocked(Handlebars.registerHelper).mockImplementation(((name: any, handler: any) => {
			if (name === 'variable') {
				variableHandler = handler;
			}
			if (name === 'variableValue') {
				variableValueHandler = handler;
			}
		}) as any);

		generateHtml({
			content: '<div></div>',
			replaceVariables: (str: string) => str,
			options,
			htmlContents: [],
		} as any);

		expect(Handlebars.registerHelper).toHaveBeenCalledWith('variable', expect.any(Function));
		expect(Handlebars.registerHelper).toHaveBeenCalledWith('variableValue', expect.any(Function));

		expect(variableHandler('varName')).toEqual([]);
		expect(variableValueHandler('varName')).toEqual('varName');
	});

	it('Should use partial handler', async () => {
		const returnFetchedPartials = [{ name: 'partialName', content: 'some content' }] as any;
		const replaceVariables = vi.fn((str: string) => str);
		const defaultParams = {
			data: { key: 'value' },
			content: '{{> partialName}}',
			partials: [{ id: 'test-partial', name: 'partialName', url: 'Partial Content' }],
			helpers: '',
			timeRange: {},
			timeZone: {},
			replaceVariables: replaceVariables,
			eventBus: {},
			options: { wrap: true },
			panelData: {},
			notifySuccess: vi.fn(),
			notifyError: vi.fn(),
			theme: {},
		} as any;

		vi.mocked(fetchAllPartials).mockImplementation(() => returnFetchedPartials);

		const { html, unsubscribe } = await generateHtml(defaultParams);

		expect(fetchAllPartials).toHaveBeenCalledWith(defaultParams.partials, replaceVariables);

		expect(Handlebars.registerPartial).toHaveBeenCalledWith(
			returnFetchedPartials[0].name,
			returnFetchedPartials[0].content
		);

		expect(html).toBeDefined();
		expect(unsubscribe).toBeUndefined();
	});

	it('Should wait until promise in code resolved', async () => {
		const content = '';

		const { unsubscribe } = await generateHtml({
			content,
			options,
			helpers: `
        return Promise.resolve(() => 123)
      `,
			htmlContents: [],
		} as any);

		expect(unsubscribe).toBeDefined();
		expect(unsubscribe).toBeInstanceOf(Function);
		expect((unsubscribe as Function)()).toEqual(123);
	});
});
