import type { StravaGateway, StravaGrant } from '../src/modules/strava/index.ts';
import {
  StravaAuthorizationRefusedError,
  StravaUnavailableError,
} from '../src/modules/strava/index.ts';

/** Codes the fake Strava accepts, and the athlete each one connects. */
export const STRAVA_CODES = {
  ada: { code: 'code-ada', athlete: { id: 1001, name: 'Ada Runner' } },
  bob: { code: 'code-bob', athlete: { id: 1002, name: 'Bob Trail' } },
} as const;

interface FakeStravaOptions {
  /** Strava is down: every call fails as unavailable. */
  readonly down?: boolean;
  /** Seconds the tokens it grants stay valid (default: six hours). */
  readonly tokensLastFor?: number;
}

/**
 * Stands in for Strava: grants tokens for {@link STRAVA_CODES}, refreshes them, and
 * records what was revoked.
 */
export function fakeStrava({ down = false, tokensLastFor = 6 * 3600 }: FakeStravaOptions = {}) {
  const revoked: string[] = [];
  const refreshed: string[] = [];
  let granted = 0;
  const control = { down };

  const tokens = (athleteId: number) => {
    granted += 1;
    return {
      accessToken: `access-${String(athleteId)}-${String(granted)}`,
      refreshToken: `refresh-${String(athleteId)}-${String(granted)}`,
      expiresAt: new Date(Date.now() + tokensLastFor * 1000),
    };
  };
  const available = () =>
    control.down ? Promise.reject(new StravaUnavailableError()) : Promise.resolve();

  const gateway: StravaGateway = {
    authorizationUrl: (state) => `https://strava.test/oauth/authorize?state=${state}`,
    exchange: async (code): Promise<StravaGrant> => {
      await available();
      const known = Object.values(STRAVA_CODES).find((entry) => entry.code === code);
      if (!known) {
        throw new StravaAuthorizationRefusedError();
      }
      return { athlete: known.athlete, tokens: tokens(known.athlete.id) };
    },
    refresh: async (refreshToken) => {
      await available();
      refreshed.push(refreshToken);
      return tokens(Number(refreshToken.split('-')[1]));
    },
    revoke: async (accessToken) => {
      await available();
      revoked.push(accessToken);
    },
  };
  return { gateway, revoked, refreshed, control };
}
