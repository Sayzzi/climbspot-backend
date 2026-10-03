import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { askLoops, itinerariesApp } from '../../../test/itineraries-app.ts';
import { flatEquivalent } from '../../../test/effort.ts';
import { fakeRouting, legs, offset } from '../../../test/routing.ts';
import { METRES_PER_DEGREE_OF_LATITUDE, REFERENCE } from '../../../test/terrain.ts';
import type { Position } from '../../shared/domain/position.ts';
import { distanceBetween } from '../../shared/domain/survey/geodesy.ts';
import { RoutingUnavailableError } from './domain/routing-provider.ts';

/** Terrain rising `gradient` metres per metre northwards. */
const risingNorth = (gradient: number) => (p: Position) =>
  200 + gradient * (p.latitude - REFERENCE.latitude) * METRES_PER_DEGREE_OF_LATITUDE;

const START = { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude };

const ask = (overrides: Record<string, unknown> = {}) => ({
  start: START,
  distance: 5000,
  relief: 'flat',
  activity: 'running',
  ...overrides,
});

interface LoopBody {
  kind: string;
  exact: boolean;
  differences: unknown[];
  length: number;
  heightGained: number;
  relief: string;
  path: { coordinates: [number, number][] };
  elevationProfile: { distance: number; elevation: number }[];
}

const loops = (body: { itineraries: LoopBody[] }) => body.itineraries;

const toPosition = ([longitude, latitude]: [number, number]): Position => ({ latitude, longitude });

describe('POST /itineraries/loops', () => {
  it('finds Loops starting and ending at the point, never shorter than asked nor 20 % longer', async () => {
    const { provider } = fakeRouting({ elevationAt: risingNorth(0) });

    const response = await askLoops(itinerariesApp(provider), ask());

    expect(response.status).toBe(200);
    const found = loops(response.body);
    expect(found.length).toBeGreaterThan(0);
    for (const loop of found) {
      expect(loop).toMatchObject({ kind: 'loop', exact: true, relief: 'flat', differences: [] });
      expect(loop.length).toBeGreaterThanOrEqual(5000);
      expect(loop.length).toBeLessThanOrEqual(6000);
      const first = loop.path.coordinates[0];
      const last = loop.path.coordinates.at(-1);
      expect(first && distanceBetween(toPosition(first), START)).toBeLessThan(5);
      expect(last && distanceBetween(toPosition(last), START)).toBeLessThan(5);
      expect(loop.elevationProfile[0]?.distance).toBe(0);
    }
  });

  it('measures the Relief from the Height Gained per kilometre', async () => {
    // Each Loop goes up and down about twice its radius northwards: ~21 m/km at 6 %.
    const { provider } = fakeRouting({ elevationAt: risingNorth(0.06) });

    const [loop] = loops(
      (await askLoops(itinerariesApp(provider), ask({ relief: 'rolling' }))).body,
    );

    expect(loop).toMatchObject({ exact: true, relief: 'rolling' });
    expect((loop?.heightGained ?? 0) / ((loop?.length ?? 1) / 1000)).toBeGreaterThan(10);
    expect((loop?.heightGained ?? 0) / ((loop?.length ?? 1) / 1000)).toBeLessThanOrEqual(25);
  });

  it('offers the closest Loops with how they differ when the Relief cannot be met', async () => {
    const { provider } = fakeRouting({ elevationAt: risingNorth(0.06) });

    const [loop] = loops((await askLoops(itinerariesApp(provider), ask({ relief: 'hilly' }))).body);

    expect(loop?.exact).toBe(false);
    expect(loop?.differences).toEqual([{ kind: 'relief', wanted: 'hilly', actual: 'rolling' }]);
  });

  it('rescales the waypoints until the length fits, with the chosen Activity, within budget', async () => {
    const { provider, calls } = fakeRouting({ elevationAt: risingNorth(0) });

    await askLoops(itinerariesApp(provider), ask({ activity: 'gravel_cycling', distance: 20_000 }));

    expect(calls.routeThrough.length).toBeLessThanOrEqual(10);
    const [first, second] = calls.routeThrough;
    const reach = (call: typeof first) =>
      Math.max(...(call?.positions ?? []).map((position) => distanceBetween(START, position)));
    expect(reach(second)).toBeGreaterThan(reach(first));
    for (const call of calls.routeThrough) {
      expect(call.activity).toBe('gravel_cycling');
      expect(call.positions[0]).toEqual(START);
      expect(call.positions.at(-1)).toEqual(START);
    }
  });

  it('tries Loops in six directions around the point before settling for another Relief', async () => {
    const { provider, calls } = fakeRouting({ elevationAt: risingNorth(0) });

    await askLoops(itinerariesApp(provider), ask({ relief: 'hilly' }));

    expect(calls.routeThrough.length).toBeLessThanOrEqual(10);
    const directions = calls.routeThrough.map(({ positions }) => {
      const waypoints = positions.slice(1, -1);
      const north = waypoints.reduce((sum, p) => sum + p.latitude - START.latitude, 0);
      const east = waypoints.reduce((sum, p) => sum + p.longitude - START.longitude, 0);
      return Math.round(((Math.atan2(east, north) * 180) / Math.PI + 360) / 60) % 6;
    });
    expect(new Set(directions).size).toBe(6);
  });

  it('steers Loops to the hills when the asked Relief is not around the point', async () => {
    // Flat, but for a 150 m hill 4.2 km north: beyond the Loops drawn around the point.
    const hill = offset(START, 0, 4200);
    const { provider, calls } = fakeRouting({
      elevationAt: (p) => 200 + 150 * Math.max(0, 1 - distanceBetween(p, hill) / 1000),
    });

    const [loop] = loops(
      (await askLoops(itinerariesApp(provider), ask({ relief: 'rolling', distance: 10_000 }))).body,
    );

    expect(loop).toMatchObject({ exact: true, relief: 'rolling' });
    expect(loop?.length).toBeGreaterThanOrEqual(10_000);
    expect(loop?.length).toBeLessThanOrEqual(12_000);
    const closest = Math.min(
      ...(loop?.path.coordinates ?? []).map((pair) => distanceBetween(toPosition(pair), hill)),
    );
    expect(closest).toBeLessThan(300);
    expect(calls.routeThrough.length + calls.routeTowards.length).toBeLessThanOrEqual(40);
  });

  it('gives the running effort of Loops asked for running, its descents counted with the floor', async () => {
    const { provider } = fakeRouting({ elevationAt: risingNorth(0.06) });

    const [loop] = (await askLoops(itinerariesApp(provider), ask({ relief: 'rolling' }))).body
      .itineraries as (LoopBody & {
      effort: { kmEffort: number; flatEquivalentDistance: number };
    })[];

    expect(loop?.effort.kmEffort).toBeCloseTo(
      (loop?.length ?? 0) / 1000 + (loop?.heightGained ?? 0) / 100,
      1,
    );
    expect(loop?.effort.flatEquivalentDistance).toBeCloseTo(
      flatEquivalent(loop?.elevationProfile ?? [], 0.9),
      0,
    );
  });

  it('gives no running effort to Loops asked for cycling', async () => {
    const { provider } = fakeRouting({ elevationAt: risingNorth(0.06) });

    const found = loops(
      (await askLoops(itinerariesApp(provider), ask({ activity: 'road_cycling' }))).body,
    );

    expect(found.length).toBeGreaterThan(0);
    for (const loop of found) {
      expect(loop).not.toHaveProperty('effort');
    }
  });

  it('stops asking once three exact Loops are found', async () => {
    const { provider, calls } = fakeRouting({ elevationAt: risingNorth(0) });

    const found = loops((await askLoops(itinerariesApp(provider), ask())).body);

    expect(found).toHaveLength(3);
    // Two calls to fit the first Loop, then one per bearing from the radius that fitted.
    expect(calls.routeThrough).toHaveLength(4);
  });

  it('never offers a Loop that cannot be brought to the asked length', async () => {
    // Whatever the waypoints, the ways make a 20 km detour.
    const { provider } = fakeRouting({
      elevationAt: risingNorth(0),
      routeThrough: ({ positions }) => legs(positions[0] ?? START, [90, 10_000], [270, 10_000]),
    });

    const response = await askLoops(itinerariesApp(provider), ask());

    expect(response.body).toEqual({ itineraries: [] });
  });

  it('answers an empty list when no way can be found', async () => {
    const { provider } = fakeRouting({
      elevationAt: risingNorth(0),
      routeThrough: () => undefined,
    });

    const response = await askLoops(itinerariesApp(provider), ask());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ itineraries: [] });
  });

  it('answers ROUTING_UNAVAILABLE when routing is down', async () => {
    const { provider } = fakeRouting({
      elevationAt: risingNorth(0),
      failWith: new RoutingUnavailableError('down'),
    });

    const response = await askLoops(itinerariesApp(provider), ask());

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { code: 'ROUTING_UNAVAILABLE' } });
  });

  it.each([
    ['no start', { start: undefined }],
    ['a distance under 1 km', { distance: 999 }],
    ['a distance over 100 km', { distance: 100_001 }],
    ['an unknown Relief', { relief: 'mountainous' }],
    ['an unknown Activity', { activity: 'swimming' }],
  ])('refuses %s with VALIDATION_FAILED', async (_, overrides) => {
    const { provider, calls } = fakeRouting({ elevationAt: risingNorth(0) });

    const response = await askLoops(itinerariesApp(provider), ask(overrides));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(calls.routeThrough).toHaveLength(0);
  });

  it('is described in the OpenAPI document', async () => {
    const { provider } = fakeRouting({ elevationAt: risingNorth(0) });

    const response = await request(itinerariesApp(provider)).get('/openapi.json');

    expect(response.body).toMatchObject({ paths: { '/itineraries/loops': { post: {} } } });
  });
});
