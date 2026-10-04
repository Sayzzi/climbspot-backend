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
      ORS_URL: 'https://api.openrouteservice.org',
      ORS_API_KEY: 'ors-key',
      STRAVA_REDIRECT_URL: 'http://localhost:5173/strava/callback',
    });
  });

  it('takes the Strava application with its token key', () => {
    const strava = {
      STRAVA_CLIENT_ID: '250132',
      STRAVA_CLIENT_SECRET: 'secret',
      STRAVA_TOKEN_KEY: Buffer.alloc(32, 1).toString('base64'),
    };

    expect(
      loadEnv({
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: supabaseUrl,
        ORS_API_KEY: 'k',
        ...strava,
      }),
    ).toMatchObject(strava);
  });

  it.each([
    ['without its token key', { STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 's' }],
    [
      'with a token key of the wrong size',
      {
        STRAVA_CLIENT_ID: '1',
        STRAVA_CLIENT_SECRET: 's',
        STRAVA_TOKEN_KEY: Buffer.alloc(16).toString('base64'),
      },
    ],
  ])('refuses the Strava application %s', (_, strava) => {
    expect(() =>
      loadEnv({
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: supabaseUrl,
        ORS_API_KEY: 'k',
        ...strava,
      }),
    ).toThrow(/STRAVA_TOKEN_KEY/);
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
