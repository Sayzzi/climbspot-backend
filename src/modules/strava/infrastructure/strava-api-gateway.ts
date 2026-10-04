import { z } from 'zod';

import {
  StravaAuthorizationRefusedError,
  StravaConnectionLostError,
  StravaUnavailableError,
  type StravaTokens,
} from '../domain/strava-connection.ts';
import type { StravaGateway, StravaGrant } from '../domain/strava-gateway.ts';

const STRAVA = 'https://www.strava.com';
/** Every outing, private ones included: they are never shown to anyone but their owner. */
const SCOPE = 'read,activity:read_all';
const TIMEOUT_MS = 10_000;

export interface StravaApiGatewayOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  /** The frontend page Strava sends Visitors back to. */
  readonly redirectUrl: string;
  readonly fetch?: typeof fetch;
}

const tokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  /** Seconds since the epoch. */
  expires_at: z.number(),
});

const grantSchema = tokensSchema.extend({
  athlete: z.object({
    id: z.number(),
    firstname: z.string().nullish(),
    lastname: z.string().nullish(),
  }),
});

const toTokens = (body: z.infer<typeof tokensSchema>): StravaTokens => ({
  accessToken: body.access_token,
  refreshToken: body.refresh_token,
  expiresAt: new Date(body.expires_at * 1000),
});

/** Strava's OAuth endpoints (developers.strava.com/docs/authentication). */
export class StravaApiGateway implements StravaGateway {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: StravaApiGatewayOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  authorizationUrl(state: string): string {
    const url = new URL('/oauth/authorize', STRAVA);
    url.search = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUrl,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: SCOPE,
      state,
    }).toString();
    return url.toString();
  }

  async exchange(code: string): Promise<StravaGrant> {
    const response = await this.post('/oauth/token', {
      grant_type: 'authorization_code',
      code,
    });
    if (response.status === 400 || response.status === 401) {
      throw new StravaAuthorizationRefusedError();
    }
    const body = grantSchema.parse(await this.ok(response).json());
    const name = [body.athlete.firstname, body.athlete.lastname].filter(Boolean).join(' ');
    return {
      athlete: { id: body.athlete.id, name: name || `Athlete ${String(body.athlete.id)}` },
      tokens: toTokens(body),
    };
  }

  async refresh(refreshToken: string): Promise<StravaTokens> {
    const response = await this.post('/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (response.status === 400 || response.status === 401) {
      throw new StravaConnectionLostError();
    }
    return toTokens(tokensSchema.parse(await this.ok(response).json()));
  }

  async revoke(accessToken: string): Promise<void> {
    const response = await this.request('/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Already withdrawn counts as revoked.
    if (response.status !== 401) {
      this.ok(response);
    }
  }

  private post(path: string, fields: Record<string, string>): Promise<Response> {
    return this.request(path, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        ...fields,
      }),
    });
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetch(new URL(path, STRAVA), {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new StravaUnavailableError({ cause: error });
    }
  }

  /** The response, unless Strava failed or its limits are reached. */
  private ok(response: Response): Response {
    if (!response.ok) {
      throw new StravaUnavailableError({
        cause: new Error(`Strava answered HTTP ${String(response.status)}`),
      });
    }
    return response;
  }
}
