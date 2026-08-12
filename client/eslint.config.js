import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import parser from '@typescript-eslint/parser';
export default [{ ignores: ['dist'] }, js.configs.recommended, { files: ['src/**/*.{ts,tsx}'], languageOptions: { parser, ecmaVersion: 2020, globals: { window: 'readonly', document: 'readonly', console: 'readonly' }, parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' } }, plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh }, rules: { ...reactHooks.configs['recommended-latest'].rules, ...reactRefresh.configs.vite.rules, 'no-unused-vars': 'off', 'no-undef': 'off' } }];
