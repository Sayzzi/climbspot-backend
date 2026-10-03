import { describe, expect, it } from 'vitest';

import { askLoops, askUphill, itinerariesApp } from '../../../test/itineraries-app.ts';
import { fakeRouting, outAndBack } from '../../../test/routing.ts';
import { METRES_PER_DEGREE_OF_LATITUDE, REFERENCE } from '../../../test/terrain.ts';
import type { Position } from '../../shared/domain/position.ts';
import { RoutingUnavailableError, type RoutingProvider } from './domain/routing-provider.ts';

const risingNorth = (p: Position) =>
  200 + 0.04 * (p.latitude - REFERENCE.latitude) * METRES_PER_DEGREE_OF_LATITUDE;

const uphill = (overrides: Record<string, unknown> = {}) => ({
  start: { latitude: 45.00001, longitude: 6 },
  length: 1000,
  minGradient: 0.02,
  maxGradient: 0.05,
  activity: 'running',
  ...overrides,
});

const loop = (overrides: Record<string, unknown> = {}) => ({
  start: { latitude: 45.00001, longitude: 6 },
  distance: 5000,
  relief: 'rolling',
  activity: 'running',
  ...overrides,
});

const DAY = 24 * 60 * 60 * 1000;

function routing() {
  return fakeRouting({
    elevationAt: risingNorth,
    roundTrip: ({ start, length, variant }) =>
      variant === 1 ? outAndBack(start, 0, length) : undefined,
  });
}

const callsMade = (calls: ReturnType<typeof routing>['calls']) =>
  calls.roundTrip.length + calls.routeThrough.length + calls.routeTowards.length;

describe('Itinerary cache', () => {
  it('answers an identical Uphill request again without routing', async () => {
    const { provider, calls } = routing();
    const app = itinerariesApp(provider);
    const first = await askUphill(app, uphill());
    const before = callsMade(calls);

    const second = await askUphill(app, uphill());

    expect(callsMade(calls)).toBe(before);
    expect(second.body).toEqual(first.body);
  });

  it('answers an identical Loop request again without routing', async () => {
    const { provider, calls } = routing();
    const app = itinerariesApp(provider);
    const first = await askLoops(app, loop());
    const before = callsMade(calls);

    const second = await askLoops(app, loop());

    expect(callsMade(calls)).toBe(before);
    expect(second.body).toEqual(first.body);
  });

  it('treats points a few metres apart as the same request', async () => {
    const { provider, calls } = routing();
    const app = itinerariesApp(provider);
    await askUphill(app, uphill({ start: { latitude: 45.00001, longitude: 6 } }));
    const before = callsMade(calls);

    await askUphill(app, uphill({ start: { latitude: 45.00004, longitude: 6.00002 } }));

    expect(callsMade(calls)).toBe(before);
  });

  it.each([
    ['another point', { start: { latitude: 45.01, longitude: 6 } }],
    ['another length', { length: 1500 }],
    ['another Gradient range', { maxGradient: 0.06 }],
    ['another radius', { radius: 5000 }],
    ['another Activity', { activity: 'trail_running' }],
  ])('routes again for %s', async (_, overrides) => {
    const { provider, calls } = routing();
    const app = itinerariesApp(provider);
    await askUphill(app, uphill());
    const before = callsMade(calls);

    await askUphill(app, uphill(overrides));

    expect(callsMade(calls)).toBeGreaterThan(before);
  });

  it('keeps Uphill and Loop requests apart', async () => {
    const { provider, calls } = routing();
    const app = itinerariesApp(provider);
    await askUphill(app, uphill());

    await askLoops(app, loop());

    expect(calls.routeThrough.length).toBeGreaterThan(0);
  });

  it('forgets answers after a day', async () => {
    let now = 0;
    const { provider, calls } = routing();
    const app = itinerariesApp(provider, { now: () => now });
    await askUphill(app, uphill());
    const before = callsMade(calls);

    now += DAY - 1;
    await askUphill(app, uphill());
    expect(callsMade(calls)).toBe(before);

    now += 2;
    await askUphill(app, uphill());
    expect(callsMade(calls)).toBeGreaterThan(before);
  });

  it('does not remember failures', async () => {
    const { provider: working, calls } = routing();
    let down = true;
    const flaky: RoutingProvider = {
      roundTrip: (...args) =>
        down ? Promise.reject(new RoutingUnavailableError('down')) : working.roundTrip(...args),
      routeThrough: (...args) =>
        down ? Promise.reject(new RoutingUnavailableError('down')) : working.routeThrough(...args),

      routeTowards: (...args) =>
        down ? Promise.reject(new RoutingUnavailableError('down')) : working.routeTowards(...args),
    };
    const app = itinerariesApp(flaky);
    expect((await askUphill(app, uphill())).status).toBe(503);

    down = false;
    const retried = await askUphill(app, uphill());

    expect(retried.status).toBe(200);
    expect(callsMade(calls)).toBeGreaterThan(0);
  });
});
