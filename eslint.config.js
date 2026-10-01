import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architectural layers (see docs/adr/0002). `module` is captured so that layers
 * may only depend on layers of the same business module. The first matching
 * descriptor wins, so the catch-all folders come last: `src/modules/*` leaves only
 * each module's `index.ts`, and `src` leaves only the composition root.
 */
const elements = [
  { type: 'domain', pattern: 'src/modules/*/domain/**', partialMatch: false, capture: ['module'] },
  {
    type: 'application',
    pattern: 'src/modules/*/application/**',
    partialMatch: false,
    capture: ['module'],
  },
  {
    type: 'infrastructure',
    pattern: 'src/modules/*/infrastructure/**',
    partialMatch: false,
    capture: ['module'],
  },
  { type: 'http', pattern: 'src/modules/*/http/**', partialMatch: false, capture: ['module'] },
  {
    type: 'module-entry',
    pattern: 'src/modules/*',
    partialMatch: false,
    capture: ['module'],
  },
  { type: 'shared-domain', pattern: 'src/shared/domain/**', partialMatch: false },
  { type: 'shared-http', pattern: 'src/shared/http/**', partialMatch: false },
  { type: 'shared-infrastructure', pattern: 'src/shared/infrastructure/**', partialMatch: false },
  { type: 'shared-config', pattern: 'src/shared/config/**', partialMatch: false },
  { type: 'composition-root', pattern: 'src', partialMatch: false },
];

const sameModule = (...types) => ({
  to: { element: { types, captured: { module: '{{ from.element.captured.module }}' } } },
});

const shared = (...types) => ({ to: { element: { types } } });

const fromLayer = (type) => ({ element: { type } });

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'drizzle']),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'import/resolver': { typescript: true, node: true },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: fromLayer('domain'),
              allow: [sameModule('domain'), shared('shared-domain')],
            },
            {
              from: fromLayer('application'),
              allow: [sameModule('domain', 'application'), shared('shared-domain')],
            },
            {
              from: fromLayer('infrastructure'),
              allow: [
                sameModule('domain', 'application', 'infrastructure'),
                shared('shared-domain', 'shared-infrastructure'),
              ],
            },
            {
              from: fromLayer('http'),
              allow: [
                sameModule('domain', 'application', 'http'),
                shared('shared-domain', 'shared-http'),
              ],
            },
            {
              from: fromLayer('module-entry'),
              allow: [
                sameModule('domain', 'application', 'infrastructure', 'http'),
                shared('shared-domain', 'shared-http', 'shared-infrastructure'),
              ],
            },
            { from: fromLayer('shared-domain'), allow: [shared('shared-domain')] },
            { from: fromLayer('shared-http'), allow: [shared('shared-http', 'shared-domain')] },
            {
              from: fromLayer('shared-infrastructure'),
              allow: [shared('shared-infrastructure', 'shared-domain')],
            },
            { from: fromLayer('shared-config'), allow: [shared('shared-config')] },
            {
              from: fromLayer('composition-root'),
              allow: [
                shared(
                  'composition-root',
                  'module-entry',
                  'shared-config',
                  'shared-http',
                  'shared-infrastructure',
                ),
              ],
            },
          ],
        },
      ],
    },
  },

  {
    // The domain is pure business logic: no frameworks, drivers or I/O.
    files: ['src/modules/*/domain/**/*.ts', 'src/shared/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^(express|drizzle-orm|postgres|pino|pino-http|cors|helmet|@asteasolutions/.*|node:.*)(/.*)?$',
              message: 'The domain layer must not depend on frameworks, drivers or I/O.',
            },
          ],
        },
      ],
    },
  },

  prettier,
);
