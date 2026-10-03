import type { AccountDirectory } from '../domain/account-directory.ts';

export interface SupabaseAccountDirectoryOptions {
  readonly projectUrl: string;
  /** Secret service-role key; held by the API only, never sent to browsers. */
  readonly serviceRoleKey: string;
  readonly fetch?: typeof fetch;
}

/** Deletes users through Supabase Auth's admin API (ADR 0009). */
export class SupabaseAccountDirectory implements AccountDirectory {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: SupabaseAccountDirectoryOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  async deleteVisitor(visitorId: string): Promise<void> {
    const { projectUrl, serviceRoleKey } = this.options;
    const response = await this.fetch(
      `${projectUrl.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(visitorId)}`,
      {
        method: 'DELETE',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    // Already gone counts as deleted.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase answered HTTP ${String(response.status)} deleting a user`);
    }
  }
}
