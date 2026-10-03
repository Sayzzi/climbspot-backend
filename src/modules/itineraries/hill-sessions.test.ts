import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { askSessions, itinerariesApp } from '../../../test/itineraries-app.ts';
import { fakeRouting } from '../../../test/routing.ts';
import { METRES_PER_DEGREE_OF_LATITUDE, REFERENCE } from '../../../test/terrain.ts';
import type { Position } from '../../shared/domain/position.ts';
import { distanceBetween } from '../../shared/domain/survey/geodesy.ts';
import { RoutingUnavailableError } from './domain/routing-provider.ts';

const START = { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude };

const northOf = (p: Position) => (p.latitude - REFERENCE.latitude) * METRES_PER_DEGREE_OF_LATITUDE;

/** Flat around the point, rising at 7 % beyond 1 km north. */
const hillNorth = (p: Position) => 200 + 0.07 * Math.max(0, northOf(p) - 1000);

const ask = (overrides: Record<string, unknown> = {}) => ({
  start: START,
  repeats: 4,
  repeatLength: 300,
  minGradient: 0.06,
  maxGradient: 0.08,
  activity: 'running',
  ...overrides,
});

interface SessionBody {
  kind: string;
  exact: boolean;
  repeats: number;
  repeat: {
    length: number;
    averageGradient: number;
    path: { coordinates: [number, number][] };
    elevationProfile: { distance: number; elevation: number }[];
  };
  warmUp: { length: number; path: { coordinates: [number, number][] } };
  totals: {
    length: number;
    heightGained: number;
    effort: { kmEffort: number; flatEquivalentDistance: number };
  };
}

const sessions = (body: { sessions: SessionBody[] }) => body.sessions;

const toPosition = ([longitude, latitude]: [number, number]): Position => ({ latitude, longitude });

describe('POST /itineraries/sessions', () => {
  it('plans Repeats of exactly the asked length, with a Warm-up from the point to their foot', async () => {
    const { provider } = fakeRouting({ elevationAt: hillNorth, roundTrip: () => undefined });

    const response = await askSessions(itinerariesApp(provider), ask());

    expect(response.status).toBe(200);
    const [session] = sessions(response.body);
    expect(session).toMatchObject({ kind: 'session', exact: true, repeats: 4 });
    expect(session?.repeat.length).toBeCloseTo(300, 0);
    expect(session?.repeat.averageGradient).toBeCloseTo(0.07, 2);
    expect(session?.repeat.elevationProfile.at(-1)?.distance).toBeCloseTo(300, 0);
    const foot = session?.repeat.path.coordinates[0];
    const warmUpEnd = session?.warmUp.path.coordinates.at(-1);
    expect(
      foot && warmUpEnd && distanceBetween(toPosition(foot), toPosition(warmUpEnd)),
    ).toBeLessThan(5);
    expect(session?.warmUp.length).toBeGreaterThanOrEqual(950);
    expect(session?.warmUp.length).toBeLessThan(1200);
  });

  it('totals the whole session, computed by hand', async () => {
    // A Warm-up north, flat for 1 km then up to the foot of the Repeat, 4 × (300 m up at
    // 7 % and back down), and the same Warm-up back.
    const { provider } = fakeRouting({ elevationAt: hillNorth, roundTrip: () => undefined });

    const [session] = sessions((await askSessions(itinerariesApp(provider), ask())).body);
    const warmUp = session?.warmUp.length ?? 0;
    const climbedToFoot = warmUp - 1000;

    expect(session?.totals.length).toBeCloseTo(2 * warmUp + 4 * 600, -1);
    expect(session?.totals.heightGained).toBeCloseTo(4 * 21 + 0.07 * climbedToFoot, -1);
    expect(session?.totals.effort.kmEffort).toBeCloseTo(
      (2 * warmUp + 2400) / 1000 + (84 + 0.07 * climbedToFoot) / 100,
      1,
    );
    // Up at C(7 %)/C(0) = 1.438, down at the 0.9 floor (Minetti alone: 0.69).
    const byHand = 2 * 1000 + climbedToFoot * (1.438 + 0.9) + 4 * (300 * 1.438 + 300 * 0.9);
    expect(Math.abs((session?.totals.effort.flatEquivalentDistance ?? 0) - byHand)).toBeLessThan(
      40,
    );
  });

  it('puts the shortest Warm-up first among sessions matching the request', async () => {
    // Rising at 7 % beyond 3 km north, and beyond 1 km south.
    const { provider } = fakeRouting({
      elevationAt: (p) =>
        200 + 0.07 * Math.max(0, northOf(p) - 3000) + 0.07 * Math.max(0, -northOf(p) - 1000),
      roundTrip: () => undefined,
    });

    const found = sessions((await askSessions(itinerariesApp(provider), ask())).body);

    expect(found.length).toBeLessThanOrEqual(3);
    const exact = found.filter((session) => session.exact);
    expect(exact.length).toBeGreaterThanOrEqual(2);
    expect(found.slice(0, exact.length)).toEqual(exact);
    const warmUps = exact.map((session) => session.warmUp.length);
    expect(warmUps).toEqual([...warmUps].sort((a, b) => a - b));
    expect(warmUps[0]).toBeLessThan(1300);
  });

  it('stays within the call budget, routing Warm-ups only for the sessions offered', async () => {
    const { provider, calls } = fakeRouting({ elevationAt: hillNorth });

    const found = sessions((await askSessions(itinerariesApp(provider), ask())).body);

    expect(
      calls.roundTrip.length + calls.routeTowards.length + calls.routeThrough.length,
    ).toBeLessThanOrEqual(40);
    expect(calls.routeThrough.length).toBe(found.length);
  });

  it.each([
    ['Repeats shorter than 200 m', { repeatLength: 150 }],
    ['Repeats longer than 2 km', { repeatLength: 2500 }],
    ['a single Repeat', { repeats: 1 }],
    ['more than 20 Repeats', { repeats: 21 }],
    ['a cycling Activity', { activity: 'road_cycling' }],
    ['a Gradient range upside down', { minGradient: 0.08, maxGradient: 0.06 }],
  ])('refuses %s', async (_, overrides) => {
    const { provider } = fakeRouting({ elevationAt: hillNorth });

    const response = await askSessions(itinerariesApp(provider), ask(overrides));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('answers an empty list when no hill is found', async () => {
    const { provider } = fakeRouting({
      elevationAt: () => 200,
      roundTrip: () => undefined,
      routeTowards: () => undefined,
    });

    const response = await askSessions(itinerariesApp(provider), ask());

    expect(response.body).toEqual({ sessions: [] });
  });

  it('answers ROUTING_UNAVAILABLE when routing is down', async () => {
    const { provider } = fakeRouting({
      elevationAt: hillNorth,
      failWith: new RoutingUnavailableError('down'),
    });

    const response = await askSessions(itinerariesApp(provider), ask());

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { code: 'ROUTING_UNAVAILABLE' } });
  });

  it('is described in the OpenAPI document', async () => {
    const { provider } = fakeRouting({ elevationAt: hillNorth });

    const response = await request(itinerariesApp(provider)).get('/openapi.json');

    expect(response.body).toMatchObject({ paths: { '/itineraries/sessions': { post: {} } } });
    expect(response.body.components.schemas.HillSession.properties.totals).toBeDefined();
  });
});
