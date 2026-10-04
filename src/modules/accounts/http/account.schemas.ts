import { z } from 'zod';

import {
  DISPLAY_NAME_MAX_LENGTH,
  FLAT_PACE_SOURCES,
  FASTEST_FLAT_PACE,
  SLOWEST_FLAT_PACE,
  type AccountWithFlatPace,
} from '../domain/account.ts';

const flatPace = z
  .number()
  .min(FASTEST_FLAT_PACE)
  .max(SLOWEST_FLAT_PACE)
  .meta({ description: 'Flat Pace in seconds per kilometre (180 to 720).', example: 330 });

export const accountSchema = z
  .object({
    displayName: z.string().meta({ description: 'Private to the Visitor.' }),
    email: z.string().nullable(),
    flatPace: flatPace.nullable().meta({
      description: 'The Flat Pace that applies: the one stated, or else the one from Strava.',
    }),
    flatPaceSource: z.enum(FLAT_PACE_SOURCES).nullable(),
    stravaFlatPace: flatPace.nullable().meta({
      description: 'The Flat Pace from Strava, even when a stated one applies.',
    }),
  })
  .meta({ id: 'Account' });

export const accountChangesSchema = z
  .object({
    displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH).optional(),
    flatPace: flatPace.nullable().optional().meta({
      description: 'A stated Flat Pace, or `null` to go back to the one from Strava.',
    }),
  })
  .meta({ id: 'AccountChanges' });

export type AccountResponse = z.infer<typeof accountSchema>;

export function toAccountResponse({
  account,
  flatPace,
  stravaFlatPace,
}: AccountWithFlatPace): AccountResponse {
  return {
    displayName: account.displayName,
    email: account.email ?? null,
    flatPace: flatPace?.secondsPerKm ?? null,
    flatPaceSource: flatPace?.source ?? null,
    stravaFlatPace: stravaFlatPace ?? null,
  };
}
