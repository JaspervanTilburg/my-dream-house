// Catches typos and missing imports (undefined names) across the modules.
export default [{
  files: ['src/**/*.js'],
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    globals: {
      window: 'readonly', document: 'readonly', location: 'readonly', localStorage: 'readonly',
      requestAnimationFrame: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
      performance: 'readonly', console: 'readonly', URLSearchParams: 'readonly',
    },
  },
  rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none' }] },
}];
