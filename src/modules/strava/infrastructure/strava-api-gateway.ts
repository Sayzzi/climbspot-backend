import { z } from 'zod';

import type { TrackSample } from '../domain/recorded-run.ts';
import {
  StravaAuthorizationRefusedError,
  StravaConnectionLostError,
  StravaUnavailableError,
  type StravaTokens,
} from '../domain/strava-connection.ts';
import type { StravaGateway, StravaGrant, StravaOuting } from '../domain/strava-gateway.ts';

const STRAVA = 'https://www.strava.com';
/** Every outing, private ones included: they are never shown to anyone but their owner. */
const SCOPE = 'read,activity:read_all';
const TIMEOUT_MS = 10_000;
/** The most outings Strava lists at once. */
const PAGE_SIZE = 200;

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

const outingsSchema = z.array(
  z.object({
    id: z.number(),
    sport_type: z.string().optional(),
    type: z.string(),
    start_date: z.iso.datetime(),
    distance: z.number(),
    moving_time: z.number(),
  }),
);

const stream = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) }).optional();

const streamsSchema = z.object({
  latlng: stream(z.tuple([z.number(), z.number()])),
  altitude: stream(z.number()),
  distance: stream(z.number()),
  time: stream(z.number()),
  moving: stream(z.boolean()),
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

  async outingsSince(accessToken: string, after: Date): Promise<StravaOuting[]> {
    const outings: StravaOuting[] = [];
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({
        after: String(Math.floor(after.getTime() / 1000)),
        per_page: String(PAGE_SIZE),
        page: String(page),
      });
      const listed = outingsSchema.parse(
        await this.read(`/api/v3/athlete/activities?${query.toString()}`, accessToken),
      );
      outings.push(
        ...listed.map((outing) => ({
          id: outing.id,
          sport: outing.sport_type ?? outing.type,
          startedAt: new Date(outing.start_date),
          distance: outing.distance,
          movingTime: outing.moving_time,
        })),
      );
      if (listed.length < PAGE_SIZE) {
        return outings.toSorted((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      }
    }
  }

  async track(accessToken: string, outingId: number): Promise<TrackSample[]> {
    const keys = 'latlng,altitude,distance,time,moving';
    const body = await this.read(
      `/api/v3/activities/${String(outingId)}/streams?keys=${keys}&key_by_type=true`,
      accessToken,
    );
    if (body === undefined) {
      return [];
    }
    const { latlng, altitude, distance, time, moving } = streamsSchema.parse(body);
    if (!latlng || !distance || !time) {
      return [];
    }
    return latlng.data.map(([latitude, longitude], index) => ({
      latitude,
      longitude,
      altitude: altitude?.data[index] ?? null,
      distance: distance.data[index] ?? 0,
      elapsed: time.data[index] ?? 0,
      moving: moving?.data[index] ?? true,
    }));
  }

  /**
   * Reads from Strava's API on the athlete's behalf; nothing when there is nothing there.
   * @throws {StravaConnectionLostError} when Strava no longer accepts the token.
   */
  private async read(path: string, accessToken: string): Promise<unknown> {
    const response = await this.request(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 401) {
      throw new StravaConnectionLostError();
    }
    if (response.status === 404) {
      return undefined;
    }
    return this.ok(response).json();
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
