module.exports = {
	root: true,
	env: {
		browser: true,
		es2020: true
	},
	extends: [],
	ignorePatterns: [
		'dist',
		'node_modules',
		'package.json',
		'.eslintrc.cjs',
	],
	parser: '@typescript-eslint/parser',
	plugins: [
		'unused-imports',
	],
	rules: {
		'unused-imports/no-unused-imports': 'warn'
	}
}
