import { z } from 'zod';

import {
  DISPLAY_NAME_MAX_LENGTH,
  FASTEST_FLAT_PACE,
  SLOWEST_FLAT_PACE,
  type Account,
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
    flatPace: flatPace.nullable(),
  })
  .meta({ id: 'Account' });

export const accountChangesSchema = z
  .object({
    displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH).optional(),
    flatPace: flatPace.nullable().optional(),
  })
  .meta({ id: 'AccountChanges' });

export type AccountResponse = z.infer<typeof accountSchema>;

export function toAccountResponse(account: Account): AccountResponse {
  return {
    displayName: account.displayName,
    email: account.email ?? null,
    flatPace: account.flatPace ?? null,
  };
}
