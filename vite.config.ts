import {defineConfig} from 'vite-plus';

export default defineConfig({
	pack: {
		entry: {
			main: 'src/resumable.ts',
			helpers: 'src/resumableHelpers.ts',
		},
		format: 'esm',
		platform: 'browser',
		target: 'baseline-widely-available',
		dts: true,
		sourcemap: true,
	},
	fmt: {
		bracketSpacing: false,
		ignorePatterns: ['samples/', '*.md'],
		jsdoc: true,
		singleQuote: true,
		sortImports: true,
		useTabs: true,
	},
	lint: {
		jsPlugins: [{name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin'}],
		rules: {'vite-plus/prefer-vite-plus-imports': 'error'},
		options: {typeAware: true, typeCheck: true},
		ignorePatterns: ['samples/'],
	},
});
