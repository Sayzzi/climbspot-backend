import { z } from 'zod';

import type { SecondFactors } from '../domain/identity.ts';

export interface SupabaseSecondFactorsOptions {
  readonly projectUrl: string;
  /** Secret service-role key; held by the API only, never sent to browsers. */
  readonly serviceRoleKey: string;
  readonly fetch?: typeof fetch;
}

const userSchema = z.object({
  factors: z.array(z.object({ status: z.string() })).nullish(),
});

/** Tells who has a verified second factor through Supabase Auth's admin API (ADR 0009). */
export class SupabaseSecondFactors implements SecondFactors {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: SupabaseSecondFactorsOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  async has(visitorId: string): Promise<boolean> {
    const { projectUrl, serviceRoleKey } = this.options;
    const response = await this.fetch(
      `${projectUrl.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(visitorId)}`,
      {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
        signal: AbortSignal.timeout(5_000),
      },
    );
    // A user gone has no factor left to give.
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new Error(`Supabase answered HTTP ${String(response.status)} reading a user`);
    }
    const { factors } = userSchema.parse(await response.json());
    return (factors ?? []).some((factor) => factor.status === 'verified');
  }
}
