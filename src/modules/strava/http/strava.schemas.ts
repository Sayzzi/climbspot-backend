import { z } from 'zod';

import type { StravaConnectionState } from '../application/strava-connections.ts';

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
    status: z.enum(['none', 'connected', 'lost']).meta({
      description: '`lost`: the Visitor withdrew ClimbSpot at Strava, and needs to connect again.',
    }),
    athlete: z.object({ name: z.string() }).nullable(),
    connectedAt: z.iso.datetime().nullable(),
    lastSyncAt: z.iso.datetime().nullable().meta({
      description: 'When Recorded Runs were last imported in full.',
    }),
    recordedRuns: z.int().nonnegative(),
  })
  .meta({ id: 'StravaConnection' });

export function toConnectionResponse({
  connection,
  recordedRuns,
}: StravaConnectionState): z.infer<typeof connectionSchema> {
  if (!connection) {
    return { status: 'none', athlete: null, connectedAt: null, lastSyncAt: null, recordedRuns };
  }
  return {
    status: connection.lostAt ? 'lost' : 'connected',
    athlete: { name: connection.athlete.name },
    connectedAt: connection.connectedAt.toISOString(),
    lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    recordedRuns,
  };
}
