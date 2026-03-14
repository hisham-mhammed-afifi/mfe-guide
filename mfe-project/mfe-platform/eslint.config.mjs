import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // === SCOPE RULES: who can depend on whom ===
            { sourceTag: 'scope:products',
              onlyDependOnLibsWithTags: ['scope:products', 'scope:shared'] },
            { sourceTag: 'scope:orders',
              onlyDependOnLibsWithTags: ['scope:orders', 'scope:shared'] },
            { sourceTag: 'scope:account',
              onlyDependOnLibsWithTags: ['scope:account', 'scope:shared'] },
            { sourceTag: 'scope:shell',
              onlyDependOnLibsWithTags: ['scope:shell', 'scope:shared'] },

            // === TYPE RULES: layered architecture ===
            // Apps can use feature, data-access, ui, util (NOT other apps)
            { sourceTag: 'type:app',
              onlyDependOnLibsWithTags:
                ['type:feature', 'type:data-access', 'type:ui', 'type:util'] },
            { sourceTag: 'type:feature',
              onlyDependOnLibsWithTags:
                ['type:data-access', 'type:ui', 'type:util'] },
            { sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:util'] },
            { sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:util'] },
            { sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util'] },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
