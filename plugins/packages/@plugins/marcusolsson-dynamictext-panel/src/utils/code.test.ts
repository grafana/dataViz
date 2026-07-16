import { createExecutionCode } from './code';

describe('Code', () => {
	describe('createExecutionCode', () => {
		const logError = vi.fn();
		const logInfo = vi.fn();

		beforeAll(() => {
			vi.spyOn(console, 'error');
			vi.spyOn(console, 'log');

			vi.mocked(console.error).mockImplementation(logError);
			vi.mocked(console.log).mockImplementation(logInfo);
		});

		/**
		 * Restore original console
		 */
		afterAll(() => {
			vi.mocked(console.error).mockRestore();
			vi.mocked(console.log).mockRestore();
		});

		it('Should create function', () => {
			const result = createExecutionCode('return 123');

			expect(result).toBeInstanceOf(Function);
			expect(result()).toEqual(123);
		});

		it('Should handle syntax error', () => {
			const code = 'con b = 1;';
			const result = createExecutionCode(code);

			expect(result).toBeInstanceOf(Function);
			expect(console.error).toHaveBeenCalled();
			expect(console.log).toHaveBeenCalledWith(code);
		});
	});
});
