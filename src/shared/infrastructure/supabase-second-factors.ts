import { z } from 'zod';

import type { SecondFactors } from '../domain/identity.ts';
import { requestUser, type SupabaseAdmin } from './supabase-admin.ts';

const userSchema = z.object({
  factors: z.array(z.object({ factor_type: z.string(), status: z.string() })).nullish(),
});

/**
 * Tells who has a verified second factor through Supabase Auth's admin API (ADR 0009):
 * an authenticator app (TOTP), the only kind ClimbSpot asks for.
 */
export class SupabaseSecondFactors implements SecondFactors {
  constructor(private readonly admin: SupabaseAdmin) {}

  async has(visitorId: string): Promise<boolean> {
    const response = await requestUser(this.admin, visitorId);
    // A user gone has no factor left to give.
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new Error(`Supabase answered HTTP ${String(response.status)} reading a user`);
    }
    const { factors } = userSchema.parse(await response.json());
    return (factors ?? []).some(
      (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
    );
  }
}
