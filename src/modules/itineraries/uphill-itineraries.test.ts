import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { askUphill, itinerariesApp } from '../../../test/itineraries-app.ts';
import { fakeRouting, legs, outAndBack } from '../../../test/routing.ts';
import { METRES_PER_DEGREE_OF_LATITUDE, REFERENCE } from '../../../test/terrain.ts';
import type { Position } from '../../shared/domain/position.ts';
import { distanceBetween } from '../../shared/domain/survey/geodesy.ts';
import { RoutingUnavailableError } from './domain/routing-provider.ts';

const northOfReference = (p: Position) =>
  (p.latitude - REFERENCE.latitude) * METRES_PER_DEGREE_OF_LATITUDE;
const eastOfReference = (p: Position) =>
  (p.longitude - REFERENCE.longitude) *
  METRES_PER_DEGREE_OF_LATITUDE *
  Math.cos((REFERENCE.latitude * Math.PI) / 180);

/** Terrain rising `north` metres per metre northwards and `east` per metre eastwards. */
const planar =
  (north: number, east = 0) =>
  (p: Position) =>
    200 + north * northOfReference(p) + east * eastOfReference(p);

const START = { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude };

const ask = (overrides: Record<string, unknown> = {}) => ({
  start: START,
  length: 1000,
  minGradient: 0.02,
  maxGradient: 0.05,
  activity: 'trail_running',
  ...overrides,
});

interface UphillBody {
  kind: string;
  exact: boolean;
  differences: unknown[];
  length: number;
  averageGradient: number;
  distanceToStart: number;
  start: { latitude: number; longitude: number; elevation: number };
  top: { latitude: number; longitude: number; elevation: number };
  path: { coordinates: [number, number][] };
  elevationProfile: { distance: number; elevation: number }[];
}

const itineraries = (body: { itineraries: UphillBody[] }) => body.itineraries;

describe('POST /itineraries/uphill', () => {
  it('finds a stretch going up at the asked Gradient, never shorter than asked', async () => {
    const { provider } = fakeRouting({
      elevationAt: planar(0.04),
      roundTrip: ({ start, length, variant }) =>
        variant === 1 ? outAndBack(start, 0, length) : undefined,
    });

    const response = await askUphill(itinerariesApp(provider), ask());

    expect(response.status).toBe(200);
    const [found] = itineraries(response.body);
    expect(found).toMatchObject({ kind: 'uphill', exact: true, differences: [] });
    expect(found?.length).toBeGreaterThanOrEqual(1000);
    expect(found?.length).toBeLessThanOrEqual(1200);
    expect(found?.averageGradient).toBeCloseTo(0.04, 3);
    expect(found?.distanceToStart).toBeLessThan(50);
    expect(found?.path.coordinates[0]?.[1]).toBeCloseTo(45, 4);
    expect(found?.elevationProfile[0]?.distance).toBe(0);
    expect(found?.elevationProfile.at(-1)?.distance).toBeCloseTo(found?.length ?? 0, 0);
  });

  it('follows the routed geometry rather than the 100 m samples', async () => {
    const { provider } = fakeRouting({
      elevationAt: planar(0.04),
      roundTrip: ({ start, length, variant }) =>
        variant === 1 ? outAndBack(start, 0, length) : undefined,
    });

    const [found] = itineraries((await askUphill(itinerariesApp(provider), ask())).body);

    // The fake routes a point every 10 m: the path keeps them, the profile samples every 100 m.
    expect(found?.path.coordinates.length).toBeGreaterThan(90);
    expect(found?.elevationProfile.length).toBeLessThan(15);
  });

  it('turns a stretch found going down the right way up', async () => {
    const { provider } = fakeRouting({
      routeThrough: () => undefined,
      elevationAt: planar(0.04),
      roundTrip: ({ start, length, variant }) =>
        variant === 1 ? outAndBack(start, 180, length) : undefined,
    });

    const [found] = itineraries((await askUphill(itinerariesApp(provider), ask())).body);

    expect(found?.exact).toBe(true);
    expect(found?.top.elevation).toBeGreaterThan(found?.start.elevation ?? Infinity);
    expect(found?.path.coordinates[0]?.[1]).toBeLessThan(45);
  });

  it('offers the closest stretch with how it differs when nothing matches', async () => {
    const { provider } = fakeRouting({
      elevationAt: planar(0.015),
      roundTrip: ({ start, length, variant }) =>
        variant === 1 ? outAndBack(start, 0, length) : undefined,
    });

    const [found] = itineraries((await askUphill(itinerariesApp(provider), ask())).body);

    expect(found?.exact).toBe(false);
    expect(found?.differences).toEqual([
      { kind: 'gradient', min: 0.02, max: 0.05, actual: expect.closeTo(0.015, 3) as number },
    ]);
  });

  it('leaves out stretches that lose too much height in Dips', async () => {
    // Rises at 6 %, but drops 40 m between 500 and 600 m north.
    const dipping = (p: Position) => {
      const north = northOfReference(p);
      if (north <= 500) return 200 + 0.06 * north;
      if (north <= 600) return 230 - 0.4 * (north - 500);
      return 190 + 0.06 * (north - 600);
    };
    const { provider } = fakeRouting({
      routeThrough: () => undefined,
      elevationAt: dipping,
      roundTrip: ({ start, length, variant }) =>
        variant === 1 ? outAndBack(start, 0, length) : undefined,
    });

    const response = await askUphill(itinerariesApp(provider), ask());

    expect(response.body).toEqual({ itineraries: [] });
  });

  it('only offers exact stretches starting within the radius', async () => {
    // 3 km east on the flat, then 1.25 km up northwards and back.
    const { provider } = fakeRouting({
      routeThrough: () => undefined,
      elevationAt: planar(0.04),
      roundTrip: ({ start, variant }) =>
        variant === 1 ? legs(start, [90, 3000], [0, 1250], [180, 1250], [270, 3000]) : undefined,
    });
    const app = itinerariesApp(provider);

    const near = await askUphill(app, ask({ radius: 2000 }));
    const wider = await askUphill(app, ask({ radius: 5000 }));

    expect(itineraries(near.body).every((itinerary) => !itinerary.exact)).toBe(true);
    expect(itineraries(near.body).every((itinerary) => itinerary.distanceToStart <= 2000)).toBe(
      true,
    );
    expect(itineraries(wider.body)[0]).toMatchObject({ exact: true });
    expect(itineraries(wider.body)[0]?.distanceToStart).toBeCloseTo(3000, -2);
  });

  it('reaches out towards the hills within the radius when there are none nearby', async () => {
    // Flat for 3 km northwards, then rising at 4 %; the round trips stay on the flat.
    const { provider, calls } = fakeRouting({
      elevationAt: (p) => 200 + 0.04 * Math.max(0, northOfReference(p) - 3000),
      roundTrip: ({ start, length, variant }) =>
        variant === 1 ? outAndBack(start, 90, length) : undefined,
    });

    const [found] = itineraries(
      (await askUphill(itinerariesApp(provider), ask({ radius: 10_000 }))).body,
    );

    expect(found).toMatchObject({ exact: true });
    expect(found?.averageGradient).toBeCloseTo(0.04, 2);
    expect(found?.distanceToStart).toBeGreaterThanOrEqual(2900);
    for (const call of calls.routeThrough) {
      expect(call.positions[0]).toEqual(START);
      expect(distanceBetween(START, call.positions.at(-1) ?? START)).toBeLessThanOrEqual(10_000);
    }
  });

  it('prefers a steady stretch to one with a wall steeper than asked', async () => {
    // Northwards a steady 4 %; eastwards flat for 650 m, then a 10 % wall: 3.5 % on average.
    const terrain = (p: Position) =>
      200 +
      0.04 * Math.max(0, northOfReference(p)) +
      0.1 * Math.min(350, Math.max(0, eastOfReference(p) - 650));
    const bearings: Record<number, number> = { 1: 90, 2: 0 };
    const { provider } = fakeRouting({
      elevationAt: terrain,
      roundTrip: ({ start, length, variant }) =>
        bearings[variant] === undefined
          ? undefined
          : outAndBack(start, bearings[variant] ?? 0, length),
      routeThrough: () => undefined,
    });

    const found = itineraries((await askUphill(itinerariesApp(provider), ask())).body);

    expect(found.map((itinerary) => Math.round(itinerary.averageGradient * 1000) / 10)).toEqual([
      4, 3.5,
    ]);
  });

  it('ranks exact stretches first, nearest the middle of the range', async () => {
    // North rises 4 %, east 1 %: north-east about 3.5 %, east 1 % (too flat).
    // Round trips go north and east; the first way heading out goes north-east.
    const geometry: Record<number, number> = { 1: 0, 2: 90 };
    let spokes = 0;
    const { provider } = fakeRouting({
      elevationAt: planar(0.04, 0.01),
      roundTrip: ({ start, length, variant }) =>
        geometry[variant] === undefined
          ? undefined
          : outAndBack(start, geometry[variant] ?? 0, length),
      routeThrough: ({ positions }) =>
        (spokes += 1) === 1 ? outAndBack(positions[0] ?? START, 45, 2500) : undefined,
    });

    const found = itineraries((await askUphill(itinerariesApp(provider), ask())).body);

    expect(
      found.map((itinerary) => [
        itinerary.exact,
        Math.round(itinerary.averageGradient * 1000) / 10,
      ]),
    ).toEqual([
      [true, 3.5],
      [true, 4],
      [false, 1],
    ]);
  });

  it('never offers more than three stretches, nor the same stretch twice', async () => {
    const bearings: Record<number, number> = { 1: 0, 2: 0, 3: 20, 4: 340, 5: 40, 6: 320 };
    const { provider } = fakeRouting({
      elevationAt: planar(0.04),
      roundTrip: ({ start, length, variant }) =>
        bearings[variant] === undefined
          ? undefined
          : outAndBack(start, bearings[variant] ?? 0, length),
    });

    const found = itineraries(
      (await askUphill(itinerariesApp(provider), ask({ minGradient: 0.03 }))).body,
    );

    expect(found).toHaveLength(3);
    const starts = found.map(
      (itinerary) => `${String(itinerary.top.latitude)},${String(itinerary.top.longitude)}`,
    );
    expect(new Set(starts).size).toBe(3);
  });

  it('asks for round trips about 2.5 times the asked length with the chosen Activity, within budget', async () => {
    const { provider, calls } = fakeRouting({
      elevationAt: planar(0.04),
      roundTrip: () => undefined,
      routeThrough: () => undefined,
    });

    await askUphill(itinerariesApp(provider), ask({ activity: 'road_cycling', length: 2000 }));

    expect(calls.roundTrip.length).toBeGreaterThan(0);
    expect(calls.roundTrip.length + calls.routeThrough.length).toBeLessThanOrEqual(10);
    expect(new Set(calls.roundTrip.map((call) => call.variant)).size).toBe(calls.roundTrip.length);
    for (const call of calls.roundTrip) {
      expect(call).toMatchObject({ activity: 'road_cycling', length: 5000, start: START });
    }
    for (const call of calls.routeThrough) {
      expect(call.activity).toBe('road_cycling');
    }
  });

  it('stops asking once three exact stretches are found', async () => {
    const bearings: Record<number, number> = { 1: 0, 2: 30 };
    const { provider, calls } = fakeRouting({
      elevationAt: planar(0.04),
      roundTrip: ({ start, length, variant }) =>
        bearings[variant] === undefined
          ? undefined
          : outAndBack(start, bearings[variant] ?? 0, length),
      routeThrough: ({ positions }) => outAndBack(positions[0] ?? START, 330, 2500),
    });

    await askUphill(itinerariesApp(provider), ask());

    expect(calls.roundTrip).toHaveLength(2);
    expect(calls.routeThrough).toHaveLength(1);
  });

  it('answers an empty list when no way can be found', async () => {
    const { provider } = fakeRouting({
      elevationAt: planar(0.04),
      roundTrip: () => undefined,
      routeThrough: () => undefined,
    });

    const response = await askUphill(itinerariesApp(provider), ask());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ itineraries: [] });
  });

  it('answers ROUTING_UNAVAILABLE when routing is down', async () => {
    const { provider } = fakeRouting({
      elevationAt: planar(0.04),
      failWith: new RoutingUnavailableError('down'),
    });

    const response = await askUphill(itinerariesApp(provider), ask());

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { code: 'ROUTING_UNAVAILABLE' } });
  });

  it.each([
    ['no start', { start: undefined }],
    ['a latitude out of range', { start: { latitude: 91, longitude: 6 } }],
    ['a length under 500 m', { length: 400 }],
    ['a length over 30 km', { length: 30_001 }],
    ['a radius over 25 km', { radius: 25_001 }],
    ['a minimum Gradient above the maximum', { minGradient: 0.06, maxGradient: 0.05 }],
    ['a Gradient above 30 %', { maxGradient: 0.31 }],
    ['a negative Gradient', { minGradient: -0.01 }],
    ['an unknown Activity', { activity: 'swimming' }],
  ])('refuses %s with VALIDATION_FAILED', async (_, overrides) => {
    const { provider, calls } = fakeRouting({ elevationAt: planar(0.04) });

    const response = await askUphill(itinerariesApp(provider), ask(overrides));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(calls.roundTrip).toHaveLength(0);
  });

  it('is described in the OpenAPI document', async () => {
    const { provider } = fakeRouting({ elevationAt: planar(0.04) });

    const response = await request(itinerariesApp(provider)).get('/openapi.json');

    expect(response.body).toMatchObject({ paths: { '/itineraries/uphill': { post: {} } } });
  });
});
