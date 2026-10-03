import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.ts';

const databaseUrl = 'postgresql://user:password@localhost:5432/climbspot';
const supabaseUrl = 'https://project.supabase.co';

describe('loadEnv', () => {
  it('applies defaults to optional variables', () => {
    const env = loadEnv({
      DATABASE_URL: databaseUrl,
      SUPABASE_URL: supabaseUrl,
      ORS_API_KEY: 'ors-key',
    });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:5173'],
      DATABASE_URL: databaseUrl,
      SUPABASE_URL: supabaseUrl,
      ELEVATION_API_URL: 'https://api.open-meteo.com/v1/elevation',
      ASCENT_CREATION_ENABLED: true,
      ORS_URL: 'https://api.openrouteservice.org',
      ORS_API_KEY: 'ors-key',
    });
  });

  it('requires an API key for the hosted OpenRouteService', () => {
    expect(() => loadEnv({ DATABASE_URL: databaseUrl, SUPABASE_URL: supabaseUrl })).toThrow(
      /ORS_API_KEY/,
    );
  });

  it('accepts a self-hosted OpenRouteService without a key', () => {
    const env = loadEnv({
      DATABASE_URL: databaseUrl,
      SUPABASE_URL: supabaseUrl,
      ORS_URL: 'http://localhost:8080/ors',
    });

    expect(env.ORS_URL).toBe('http://localhost:8080/ors');
    expect(env.ORS_API_KEY).toBeUndefined();
  });

  it('disables Ascent creation in production unless explicitly enabled', () => {
    expect(
      loadEnv({
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: supabaseUrl,
        ORS_API_KEY: 'ors-key',
        NODE_ENV: 'production',
      }),
    ).toMatchObject({
      ASCENT_CREATION_ENABLED: false,
    });
    expect(
      loadEnv({
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: supabaseUrl,
        ORS_API_KEY: 'ors-key',
        NODE_ENV: 'production',
        ASCENT_CREATION_ENABLED: 'true',
      }),
    ).toMatchObject({ ASCENT_CREATION_ENABLED: true });
  });

  it('lets Ascent creation be disabled outside production', () => {
    expect(
      loadEnv({
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: supabaseUrl,
        ORS_API_KEY: 'ors-key',
        ASCENT_CREATION_ENABLED: 'false',
      }),
    ).toMatchObject({
      ASCENT_CREATION_ENABLED: false,
    });
  });

  it('rejects an Ascent creation flag that is not a boolean', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: supabaseUrl,
        ORS_API_KEY: 'ors-key',
        ASCENT_CREATION_ENABLED: 'maybe',
      }),
    ).toThrow(/ASCENT_CREATION_ENABLED/);
  });

  it('accepts another elevation API endpoint', () => {
    const env = loadEnv({
      DATABASE_URL: databaseUrl,
      SUPABASE_URL: supabaseUrl,
      ORS_API_KEY: 'ors-key',
      ELEVATION_API_URL: 'https://dem.example.com/v1/elevation',
    });

    expect(env.ELEVATION_API_URL).toBe('https://dem.example.com/v1/elevation');
  });

  it('rejects an elevation API endpoint that is not a URL', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: supabaseUrl,
        ORS_API_KEY: 'ors-key',
        ELEVATION_API_URL: 'nope',
      }),
    ).toThrow(/ELEVATION_API_URL/);
  });

  it('splits and trims the list of CORS origins', () => {
    const env = loadEnv({
      DATABASE_URL: databaseUrl,
      SUPABASE_URL: supabaseUrl,
      ORS_API_KEY: 'ors-key',
      CORS_ORIGINS: 'https://climbspot.app, https://preview.climbspot.app',
    });

    expect(env.CORS_ORIGINS).toEqual(['https://climbspot.app', 'https://preview.climbspot.app']);
  });

  it('requires the Supabase project', () => {
    expect(() => loadEnv({ DATABASE_URL: databaseUrl, ORS_API_KEY: 'ors-key' })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it('fails fast when a required variable is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});
