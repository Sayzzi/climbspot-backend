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
      ELEVATION_API_URL: 'https://api.open-meteo.com/v1/elevation',
      ASCENT_CREATION_ENABLED: true,
    });
  });

  it('disables Ascent creation in production unless explicitly enabled', () => {
    expect(loadEnv({ DATABASE_URL: databaseUrl, NODE_ENV: 'production' })).toMatchObject({
      ASCENT_CREATION_ENABLED: false,
    });
    expect(
      loadEnv({
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'production',
        ASCENT_CREATION_ENABLED: 'true',
      }),
    ).toMatchObject({ ASCENT_CREATION_ENABLED: true });
  });

  it('lets Ascent creation be disabled outside production', () => {
    expect(loadEnv({ DATABASE_URL: databaseUrl, ASCENT_CREATION_ENABLED: 'false' })).toMatchObject({
      ASCENT_CREATION_ENABLED: false,
    });
  });

  it('rejects an Ascent creation flag that is not a boolean', () => {
    expect(() => loadEnv({ DATABASE_URL: databaseUrl, ASCENT_CREATION_ENABLED: 'maybe' })).toThrow(
      /ASCENT_CREATION_ENABLED/,
    );
  });

  it('accepts another elevation API endpoint', () => {
    const env = loadEnv({
      DATABASE_URL: databaseUrl,
      ELEVATION_API_URL: 'https://dem.example.com/v1/elevation',
    });

    expect(env.ELEVATION_API_URL).toBe('https://dem.example.com/v1/elevation');
  });

  it('rejects an elevation API endpoint that is not a URL', () => {
    expect(() => loadEnv({ DATABASE_URL: databaseUrl, ELEVATION_API_URL: 'nope' })).toThrow(
      /ELEVATION_API_URL/,
    );
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
