import js from '@eslint/js';
import n from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      'no-undef': 'off',
    },
  },
  {
    plugins: { n },
    rules: {
      'n/no-missing-import': 'off',
      'n/no-unsupported-features/es-syntax': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];

