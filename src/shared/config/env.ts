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
    ELEVATION_API_URL: z.url().default('https://api.open-meteo.com/v1/elevation'),
    /** OpenRouteService used to plan Itineraries (ADR 0008): hosted, or self-hosted. */
    ORS_URL: z.url().default(HOSTED_OPEN_ROUTE_SERVICE),
    /** Key for the hosted OpenRouteService; a self-hosted one needs none. */
    ORS_API_KEY: z.string().min(1).optional(),
    /** Temporary guard until Contributors are authenticated; off in production by default. */
    ASCENT_CREATION_ENABLED: z.stringbool().optional(),
  })
  .refine((env) => env.ORS_URL !== HOSTED_OPEN_ROUTE_SERVICE || env.ORS_API_KEY !== undefined, {
    path: ['ORS_API_KEY'],
    message: 'The hosted OpenRouteService needs an API key.',
  })
  .transform(({ ASCENT_CREATION_ENABLED, ...env }) => ({
    ...env,
    ASCENT_CREATION_ENABLED: ASCENT_CREATION_ENABLED ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

/** Validates the environment once at startup so misconfiguration fails fast. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
