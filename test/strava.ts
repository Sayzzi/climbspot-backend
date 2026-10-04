import type {
  StravaGateway,
  StravaGrant,
  StravaOuting,
  TrackSample,
} from '../src/modules/strava/index.ts';
import {
  StravaAuthorizationRefusedError,
  StravaConnectionLostError,
  StravaUnavailableError,
} from '../src/modules/strava/index.ts';
import type { Position } from '../src/shared/domain/position.ts';
import { METRES_PER_DEGREE_OF_LATITUDE, REFERENCE } from './terrain.ts';

/** Codes the fake Strava accepts, and the athlete each one connects. */
export const STRAVA_CODES = {
  ada: { code: 'code-ada', athlete: { id: 1001, name: 'Ada Runner' } },
  bob: { code: 'code-bob', athlete: { id: 1002, name: 'Bob Trail' } },
} as const;

const DAY_MS = 24 * 3600 * 1000;

/** An outing as the fake Strava keeps it: its summary, and its recorded samples. */
export interface FakeOuting extends StravaOuting {
  readonly samples: readonly TrackSample[];
}

/**
 * Samples recorded every `spacing` metres while running due north of `from` at a
 * steady `secondsPerKm`, on a steady `gradient` (flat unless told otherwise).
 */
export function runNorth(
  length: number,
  { from = REFERENCE, secondsPerKm = 300, spacing = 2, altitude = 200, gradient = 0 } = {},
): TrackSample[] {
  return Array.from({ length: Math.floor(length / spacing) + 1 }, (_, index) => {
    const distance = index * spacing;
    const position: Position = {
      latitude: from.latitude + distance / METRES_PER_DEGREE_OF_LATITUDE,
      longitude: from.longitude,
    };
    const time = (distance / 1000) * secondsPerKm;
    return {
      ...position,
      altitude: altitude + distance * gradient,
      distance,
      elapsed: time,
      moving: true,
    };
  });
}

let nextOutingId = 1;

/** A run recorded `daysAgo` days ago, 1 km due north unless told otherwise. */
export function anOuting(overrides: Partial<FakeOuting> & { daysAgo?: number } = {}): FakeOuting {
  const { daysAgo = 1, ...rest } = overrides;
  const samples = rest.samples ?? runNorth(1000);
  const last = samples.at(-1);
  return {
    id: nextOutingId++,
    sport: 'Run',
    startedAt: new Date(Date.now() - daysAgo * DAY_MS),
    distance: last?.distance ?? 0,
    movingTime: last?.elapsed ?? 0,
    samples,
    ...rest,
  };
}

interface FakeStravaOptions {
  /** Strava is down: every call fails as unavailable. */
  readonly down?: boolean;
  /** Seconds the tokens it grants stay valid (default: six hours). */
  readonly tokensLastFor?: number;
  /** Each athlete's outings. */
  readonly outings?: Record<number, FakeOuting[]>;
}

/**
 * Stands in for Strava: grants tokens for {@link STRAVA_CODES}, refreshes them, serves
 * outings and their samples, and records what was asked. `control` changes it on the way:
 * down, a number of requests left before its limits are reached, athletes who withdrew
 * ClimbSpot's access.
 */
export function fakeStrava({
  down = false,
  tokensLastFor = 6 * 3600,
  outings = {},
}: FakeStravaOptions = {}) {
  const revoked: string[] = [];
  const refreshed: string[] = [];
  const tracksRead: number[] = [];
  let granted = 0;
  const control = {
    down,
    /** Requests Strava still answers before its limits are reached; unlimited when undefined. */
    requestsLeft: undefined as number | undefined,
    withdrawn: new Set<number>(),
    outings,
  };

  const tokens = (athleteId: number) => {
    granted += 1;
    return {
      accessToken: `access-${String(athleteId)}-${String(granted)}`,
      refreshToken: `refresh-${String(athleteId)}-${String(granted)}`,
      expiresAt: new Date(Date.now() + tokensLastFor * 1000),
    };
  };
  const athleteOf = (token: string) => Number(token.split('-')[1]);
  const answer = async (athleteId?: number) => {
    if (control.down || control.requestsLeft === 0) {
      throw new StravaUnavailableError();
    }
    if (control.requestsLeft !== undefined) {
      control.requestsLeft -= 1;
    }
    if (athleteId !== undefined && control.withdrawn.has(athleteId)) {
      throw new StravaConnectionLostError();
    }
    await Promise.resolve();
  };

  const gateway: StravaGateway = {
    authorizationUrl: (state) => `https://strava.test/oauth/authorize?state=${state}`,
    exchange: async (code): Promise<StravaGrant> => {
      await answer();
      const known = Object.values(STRAVA_CODES).find((entry) => entry.code === code);
      if (!known) {
        throw new StravaAuthorizationRefusedError();
      }
      control.withdrawn.delete(known.athlete.id);
      return { athlete: known.athlete, tokens: tokens(known.athlete.id) };
    },
    refresh: async (refreshToken) => {
      await answer(athleteOf(refreshToken));
      refreshed.push(refreshToken);
      return tokens(athleteOf(refreshToken));
    },
    revoke: async (accessToken) => {
      await answer();
      revoked.push(accessToken);
    },
    outingsSince: async (accessToken, after) => {
      const athlete = athleteOf(accessToken);
      await answer(athlete);
      return (control.outings[athlete] ?? [])
        .filter((outing) => outing.startedAt > after)
        .toSorted((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .map(({ samples: _samples, ...summary }) => summary);
    },
    track: async (accessToken, outingId) => {
      const athlete = athleteOf(accessToken);
      await answer(athlete);
      tracksRead.push(outingId);
      return (
        (control.outings[athlete] ?? []).find((outing) => outing.id === outingId)?.samples ?? []
      );
    },
  };
  return { gateway, revoked, refreshed, tracksRead, control };
}
