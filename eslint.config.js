import tseslint from 'typescript-eslint';

export default [
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      'react/prop-types': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'block-like', next: '*' },
      ],
    },
  },
];
