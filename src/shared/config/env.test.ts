import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.ts';

const databaseUrl = 'postgresql://user:password@localhost:5432/climbspot';

describe('loadEnv', () => {
  it('applies defaults to optional variables', () => {
    const env = loadEnv({ DATABASE_URL: databaseUrl });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:5173'],
      DATABASE_URL: databaseUrl,
    });
  });

  it('splits and trims the list of CORS origins', () => {
    const env = loadEnv({
      DATABASE_URL: databaseUrl,
      CORS_ORIGINS: 'https://climbspot.app, https://preview.climbspot.app',
    });

    expect(env.CORS_ORIGINS).toEqual(['https://climbspot.app', 'https://preview.climbspot.app']);
  });

  it('fails fast when a required variable is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});
