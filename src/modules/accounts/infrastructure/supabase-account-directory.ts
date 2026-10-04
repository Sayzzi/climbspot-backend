import { requestUser, type SupabaseAdmin } from '../../../shared/infrastructure/supabase-admin.ts';
import type { AccountDirectory } from '../domain/account-directory.ts';

/** Deletes users through Supabase Auth's admin API (ADR 0009). */
export class SupabaseAccountDirectory implements AccountDirectory {
  constructor(private readonly admin: SupabaseAdmin) {}

  async deleteVisitor(visitorId: string): Promise<void> {
    const response = await requestUser(this.admin, visitorId, { method: 'DELETE' });
    // Already gone counts as deleted.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase answered HTTP ${String(response.status)} deleting a user`);
    }
  }
}
