import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['node_modules/', 'dist/', 'build/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
]
