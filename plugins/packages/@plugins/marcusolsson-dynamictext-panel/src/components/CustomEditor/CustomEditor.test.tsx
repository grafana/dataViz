import { getTemplateSrv } from '@grafana/runtime';
import { CodeEditorSuggestionItemKind } from '@grafana/ui';
import { render, screen } from '@testing-library/react';

import {
	AFTER_RENDER_EDITOR_SUGGESTIONS,
	CodeLanguage,
	Format,
	HELPERS_EDITOR_SUGGESTIONS,
	TEST_IDS,
} from '../../constants';

import { AutosizeCodeEditor } from '../AutosizeCodeEditor';
import { AfterRenderEditor, CustomEditor, HelpersEditor, StylesEditor, TextEditor } from './CustomEditor';

/**
 * Mock @grafana/ui
 */
vi.mock('@grafana/ui', async () => ({
	...(await vi.importActual('@grafana/ui')),
	CodeEditor: vi.fn().mockImplementation(() => null),
}));

/**
 * Mock AutosizeCodeEditor
 */
vi.mock('../AutosizeCodeEditor', async () => ({
	...(await vi.importActual('../AutosizeCodeEditor')),
	AutosizeCodeEditor: vi.fn().mockImplementation(() => null),
}));

/**
 * Mock @grafana/runtime
 */
vi.mock('@grafana/runtime', () => ({
	getTemplateSrv: vi.fn(),
}));

/**
 * Mock timers
 */
vi.useFakeTimers();

/**
 * Custom Editor
 */
describe('Custom Editor', () => {
	const getContext = (modifiers: string[] = []) => {
		const editor = {
			format: Format.NONE,
			language: '123',
		};

		if (modifiers.includes('enableFormatting')) {
			editor.format = Format.AUTO;
		}

		return {
			options: {
				editor,
			},
		};
	};

	const editorItem = {
		name: 'test',
	};
	/**
	 * Get Tested Component
	 * @param restProps
	 * @param context
	 */
	const getComponent = ({ ...restProps }: any, context = getContext()) => {
		return <CustomEditor {...restProps} context={context} item={editorItem} />;
	};

	const onChange = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('Should find component', async () => {
		render(getComponent({}));
		expect(screen.getByTestId(TEST_IDS.textEditor.root)).toBeInTheDocument();
	});

	it('Should show mini map if value more than 100 symbols', () => {
		render(getComponent({ value: new Array(102).join('1') }));

		expect(AutosizeCodeEditor).toHaveBeenCalledWith(
			expect.objectContaining({
				showMiniMap: true,
			}),
			expect.anything()
		);
	});

	it('Should not enable formatting if disabled', () => {
		const runFormatDocument = vi.fn();
		const editor = {
			getAction: vi.fn().mockImplementation(() => ({
				run: runFormatDocument,
			})),
		};

		vi.mocked(AutosizeCodeEditor).mockImplementation(({ onEditorDidMount }: any) => {
			onEditorDidMount(editor);
			return null;
		});

		render(getComponent({}, getContext([])));
		vi.runAllTimers();

		expect(AutosizeCodeEditor).toHaveBeenCalledWith(
			expect.objectContaining({
				monacoOptions: {
					formatOnPaste: false,
					formatOnType: false,
					scrollBeyondLastLine: false,
				},
			}),
			expect.anything()
		);
		expect(editor.getAction).not.toHaveBeenCalledWith('editor.action.formatDocument');
		expect(runFormatDocument).not.toHaveBeenCalled();
	});

	it('Should enable formatting if enabled', () => {
		const runFormatDocument = vi.fn();
		const editor = {
			getAction: vi.fn().mockImplementation(() => ({
				run: runFormatDocument,
			})),
		};

		vi.mocked(AutosizeCodeEditor).mockImplementation(({ onEditorDidMount }: any) => {
			onEditorDidMount(editor);
			return null;
		});

		render(getComponent({}, getContext(['enableFormatting'])));
		vi.runAllTimers();

		expect(AutosizeCodeEditor).toHaveBeenCalledWith(
			expect.objectContaining({
				monacoOptions: {
					formatOnPaste: true,
					formatOnType: true,
					scrollBeyondLastLine: false,
				},
			}),
			expect.anything()
		);
		expect(editor.getAction).toHaveBeenCalledWith('editor.action.formatDocument');
		expect(runFormatDocument).toHaveBeenCalled();
	});

	it('Should save changes on blur', () => {
		const value = 'some value';
		const onChange = vi.fn();

		vi.mocked(AutosizeCodeEditor).mockImplementation(({ onBlur }: any) => {
			onBlur(value);
			return null;
		});

		render(
			getComponent({
				onChange,
			})
		);

		expect(onChange).toHaveBeenCalledWith(value);
	});

	it('Should pass value on save', () => {
		const value = 'some value';
		const onChange = vi.fn();

		vi.mocked(AutosizeCodeEditor).mockImplementation(({ onSave }: any) => {
			onSave(value);
			return null;
		});

		render(
			getComponent({
				onChange,
			})
		);

		expect(onChange).toHaveBeenCalledWith(value);
	});

	describe('Text Editor', () => {
		/**
		 * Properties
		 */
		const props: any = { context: { options: { editor: { language: '123' } } }, onChange };

		it('Should use language from options', () => {
			render(<TextEditor {...props} item={editorItem} />);

			expect(AutosizeCodeEditor).toHaveBeenCalledWith(
				expect.objectContaining({
					language: '123',
				}),
				expect.anything()
			);
		});

		it('Should make correct suggestions', () => {
			let suggestionsResult;
			const variableWithDescription = { name: 'var1', description: 'Var description', label: 'Var Label' };
			const variableWithoutDescription = { name: 'var2', description: '', label: 'Var 2' };
			const variables = [variableWithDescription, variableWithoutDescription];

			vi.mocked(AutosizeCodeEditor).mockImplementation(({ getSuggestions }: any) => {
				suggestionsResult = getSuggestions();
				return null;
			});
			vi.mocked(getTemplateSrv).mockImplementation(
				() =>
					({
						getVariables: vi.fn().mockImplementation(() => variables),
					}) as any
			);

			render(<TextEditor {...props} item={editorItem} />);

			expect(suggestionsResult).toEqual([]);
		});
	});

	describe('Helpers Editor', () => {
		/**
		 * Properties
		 */
		const props: any = { context: { options: { editor: {} } }, onChange };

		it('Should use javascript language', () => {
			render(<HelpersEditor {...props} item={editorItem} />);

			expect(AutosizeCodeEditor).toHaveBeenCalledWith(
				expect.objectContaining({
					language: CodeLanguage.JAVASCRIPT,
				}),
				expect.anything()
			);
		});

		it('Should make correct suggestions', () => {
			let suggestionsResult;
			const variableWithDescription = { name: 'var1', description: 'Var description', label: 'Var Label' };
			const variableWithoutDescription = { name: 'var2', description: '', label: 'Var 2' };
			const variables = [variableWithDescription, variableWithoutDescription];

			vi.mocked(AutosizeCodeEditor).mockImplementation(({ getSuggestions }: any) => {
				suggestionsResult = getSuggestions();
				return null;
			});
			vi.mocked(getTemplateSrv).mockImplementation(
				() =>
					({
						getVariables: vi.fn().mockImplementation(() => variables),
					}) as any
			);

			render(<HelpersEditor {...props} item={editorItem} />);

			expect(suggestionsResult).toEqual(expect.arrayContaining(HELPERS_EDITOR_SUGGESTIONS));
			expect(suggestionsResult).toEqual(
				expect.arrayContaining([
					{
						label: `$\{${variableWithDescription.name}}`,
						kind: CodeEditorSuggestionItemKind.Property,
						detail: variableWithDescription.description,
					},
				])
			);
			expect(suggestionsResult).toEqual(
				expect.arrayContaining([
					{
						label: `$\{${variableWithoutDescription.name}}`,
						kind: CodeEditorSuggestionItemKind.Property,
						detail: variableWithoutDescription.label,
					},
				])
			);
		});
	});

	describe('After Render Editor', () => {
		/**
		 * Properties
		 */
		const props: any = { context: { options: { editor: {} } }, onChange };

		it('Should use javascript language', () => {
			render(<AfterRenderEditor {...props} item={editorItem} />);

			expect(AutosizeCodeEditor).toHaveBeenCalledWith(
				expect.objectContaining({
					language: CodeLanguage.JAVASCRIPT,
				}),
				expect.anything()
			);
		});

		it('Should make correct suggestions', () => {
			let suggestionsResult;
			const variableWithDescription = { name: 'var1', description: 'Var description', label: 'Var Label' };
			const variableWithoutDescription = { name: 'var2', description: '', label: 'Var 2' };
			const variables = [variableWithDescription, variableWithoutDescription];

			vi.mocked(AutosizeCodeEditor).mockImplementation(({ getSuggestions }: any) => {
				suggestionsResult = getSuggestions();
				return null;
			});
			vi.mocked(getTemplateSrv).mockImplementation(
				() =>
					({
						getVariables: vi.fn().mockImplementation(() => variables),
					}) as any
			);

			render(<AfterRenderEditor {...props} item={editorItem} />);

			expect(suggestionsResult).toEqual(expect.arrayContaining(AFTER_RENDER_EDITOR_SUGGESTIONS));
			expect(suggestionsResult).toEqual(
				expect.arrayContaining([
					{
						label: `$\{${variableWithDescription.name}}`,
						kind: CodeEditorSuggestionItemKind.Property,
						detail: variableWithDescription.description,
					},
				])
			);
			expect(suggestionsResult).toEqual(
				expect.arrayContaining([
					{
						label: `$\{${variableWithoutDescription.name}}`,
						kind: CodeEditorSuggestionItemKind.Property,
						detail: variableWithoutDescription.label,
					},
				])
			);
		});
	});

	describe('Styles Editor', () => {
		/**
		 * Properties
		 */
		const props: any = { context: { options: { editor: {} } }, onChange };

		it('Should use javascript language', () => {
			render(<StylesEditor {...props} item={editorItem} />);

			expect(AutosizeCodeEditor).toHaveBeenCalledWith(
				expect.objectContaining({
					language: CodeLanguage.SCSS,
				}),
				expect.anything()
			);
		});

		it('Should make correct suggestions', () => {
			let suggestionsResult;
			const variableWithDescription = { name: 'var1', description: 'Var description', label: 'Var Label' };
			const variableWithoutDescription = { name: 'var2', description: '', label: 'Var 2' };
			const variables = [variableWithDescription, variableWithoutDescription];

			vi.mocked(AutosizeCodeEditor).mockImplementation(({ getSuggestions }: any) => {
				suggestionsResult = getSuggestions();
				return null;
			});
			vi.mocked(getTemplateSrv).mockImplementation(
				() =>
					({
						getVariables: vi.fn().mockImplementation(() => variables),
					}) as any
			);

			render(<StylesEditor {...props} item={editorItem} />);

			expect(suggestionsResult).toEqual(
				expect.arrayContaining([
					{
						label: `$\{${variableWithDescription.name}}`,
						kind: CodeEditorSuggestionItemKind.Property,
						detail: variableWithDescription.description,
					},
				])
			);
			expect(suggestionsResult).toEqual(
				expect.arrayContaining([
					{
						label: `$\{${variableWithoutDescription.name}}`,
						kind: CodeEditorSuggestionItemKind.Property,
						detail: variableWithoutDescription.label,
					},
				])
			);
		});
	});
});
