import { z } from 'zod';

import type { StravaConnection } from '../domain/strava-connection.ts';

export const authorizationSchema = z
  .object({ url: z.url().meta({ description: "Strava's page where the Visitor agrees." }) })
  .meta({ id: 'StravaAuthorization' });

export const connectionRequestSchema = z
  .object({
    code: z.string().min(1).meta({ description: 'The code Strava sent back.' }),
    state: z.string().min(1).meta({ description: 'The state Strava sent back with it.' }),
  })
  .meta({ id: 'StravaConnectionRequest' });

export const connectionSchema = z
  .object({
    status: z.enum(['none', 'connected']),
    athlete: z.object({ name: z.string() }).nullable(),
    connectedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'StravaConnection' });

export function toConnectionResponse(
  connection: StravaConnection | undefined,
): z.infer<typeof connectionSchema> {
  return connection
    ? {
        status: 'connected',
        athlete: { name: connection.athlete.name },
        connectedAt: connection.connectedAt.toISOString(),
      }
    : { status: 'none', athlete: null, connectedAt: null };
}
