/** Calling Supabase Auth's admin API with the service-role key (ADR 0009). */
export interface SupabaseAdmin {
  readonly projectUrl: string;
  /** Secret service-role key; held by the API only, never sent to browsers. */
  readonly serviceRoleKey: string;
  readonly fetch?: typeof fetch;
}

/** A request to one user through Supabase Auth's admin API. */
export function requestUser(
  { projectUrl, serviceRoleKey, fetch: send = fetch }: SupabaseAdmin,
  visitorId: string,
  init: RequestInit = {},
): Promise<Response> {
  return send(
    `${projectUrl.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(visitorId)}`,
    {
      ...init,
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
}
