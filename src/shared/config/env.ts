import { z } from 'zod';

const HOSTED_OPEN_ROUTE_SERVICE = 'https://api.openrouteservice.org';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    DATABASE_URL: z.url(),
    /** The Supabase project whose access tokens identify signed-in Visitors (ADR 0009). */
    SUPABASE_URL: z.url(),
    /** Secret key deleting accounts from Supabase Auth; without it, accounts cannot be deleted. */
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    ELEVATION_API_URL: z.url().default('https://api.open-meteo.com/v1/elevation'),
    /** OpenRouteService used to plan Itineraries (ADR 0008): hosted, or self-hosted. */
    ORS_URL: z.url().default(HOSTED_OPEN_ROUTE_SERVICE),
    /** Key for the hosted OpenRouteService; a self-hosted one needs none. */
    ORS_API_KEY: z.string().min(1).optional(),
    /** ClimbSpot's Strava application (strava.com/settings/api); without it, Strava is unavailable. */
    STRAVA_CLIENT_ID: z.string().min(1).optional(),
    STRAVA_CLIENT_SECRET: z.string().min(1).optional(),
    /** 32 random bytes, base64 (`openssl rand -base64 32`): encrypts the stored Strava tokens. */
    STRAVA_TOKEN_KEY: z
      .base64()
      .refine((key) => Buffer.from(key, 'base64').length === 32, '32 bytes, base64-encoded')
      .optional(),
    /** The frontend page Strava sends Visitors back to. */
    STRAVA_REDIRECT_URL: z.url().default('http://localhost:5173/strava/callback'),
  })
  .refine((env) => env.ORS_URL !== HOSTED_OPEN_ROUTE_SERVICE || env.ORS_API_KEY !== undefined, {
    path: ['ORS_API_KEY'],
    message: 'The hosted OpenRouteService needs an API key.',
  })
  .refine(
    (env) =>
      [env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, env.STRAVA_TOKEN_KEY].every(
        (value) => value === undefined,
      ) ||
      [env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, env.STRAVA_TOKEN_KEY].every(
        (value) => value !== undefined,
      ),
    {
      path: ['STRAVA_TOKEN_KEY'],
      message: 'Strava needs its client id, client secret and token key together.',
    },
  );

export type Env = z.infer<typeof envSchema>;

/** Validates the environment once at startup so misconfiguration fails fast. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
