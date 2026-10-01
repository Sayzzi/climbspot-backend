import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Starts PostGIS in Docker once per run (see test/global-setup.ts).
    globalSetup: ['./test/global-setup.ts'],
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts'],
    },
  },
});
