import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    timeout: 10000, // en milisegundos (10s),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85
      },
      exclude: [
        'index.js',
        'src/**/*.routes.js',
        'vitest.config.js',
        'eslint.config.js',
        'src/utils/config.js',
        'src/utils/constants.js',
      ]
    }
  }
})
