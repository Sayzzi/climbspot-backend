import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { uploadGpx, useAscentsApp } from '../../../test/ascents-app.ts';
import { gpxTrack } from '../../../test/gpx.ts';
import { northOf, ORIGIN, straightNorth } from '../../../test/terrain.ts';

const buildApp = useAscentsApp();

/** Catalogues a 1.2 km Ascent at 8 % (Cat 4) whose Start lies `distanceNorth` metres north of ORIGIN. */
async function ascentStartingNorth(app: Express, name: string, distanceNorth: number) {
  const [start] = northOf(ORIGIN, distanceNorth);
  if (start === undefined) {
    throw new Error('unreachable');
  }
  const response = await uploadGpx(app, gpxTrack(straightNorth(start, 1200)), { name });
  expect(response.status).toBe(201);
}

function searchNearby(app: Express, query: Record<string, string | number> = {}) {
  return request(app)
    .get('/ascents/nearby')
    .query({ latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, ...query });
}

const names = (body: { ascents: { name: string }[] }) => body.ascents.map((ascent) => ascent.name);

describe('GET /ascents/nearby', () => {
  it('lists Ascents nearest Start first, with their distance to the Start', async () => {
    const app = buildApp();
    await ascentStartingNorth(app, 'Five km', 5000);
    await ascentStartingNorth(app, 'One km', 1000);
    await ascentStartingNorth(app, 'Three km', 3000);

    const response = await searchNearby(app);

    expect(response.status).toBe(200);
    expect(names(response.body)).toEqual(['One km', 'Three km', 'Five km']);
    const distances = response.body.ascents.map(
      (ascent: { distanceToStart: number }) => ascent.distanceToStart,
    );
    expect(distances[0]).toBeGreaterThan(990);
    expect(distances[0]).toBeLessThan(1010);
    expect(distances[2]).toBeGreaterThan(4950);
    expect(distances[2]).toBeLessThan(5050);
  });

  it('returns summaries without the full path', async () => {
    const app = buildApp();
    await ascentStartingNorth(app, 'One km', 1000);

    const response = await searchNearby(app);

    const [ascent] = response.body.ascents;
    expect(ascent).toMatchObject({
      name: 'One km',
      surface: 'paved',
      activities: ['running', 'road_cycling'],
      category: 'cat4',
      start: { longitude: 6 },
    });
    expect(ascent.length).toBeCloseTo(1200, 0);
    expect(ascent.elevationGain).toBeCloseTo(96, 1);
    expect(ascent).not.toHaveProperty('path');
    expect(ascent).not.toHaveProperty('elevationProfile');
  });

  it('only keeps Ascents whose Start is within 10 km by default', async () => {
    const app = buildApp();
    await ascentStartingNorth(app, 'Inside', 9500);
    await ascentStartingNorth(app, 'Outside', 10_500);

    const response = await searchNearby(app);

    expect(names(response.body)).toEqual(['Inside']);
  });

  it('honours a custom radius', async () => {
    const app = buildApp();
    await ascentStartingNorth(app, 'Near', 1000);
    await ascentStartingNorth(app, 'Far', 3000);

    const response = await searchNearby(app, { radius: 2000 });

    expect(names(response.body)).toEqual(['Near']);
  });

  it('ignores Ascents whose path, but not Start, is within the radius', async () => {
    const app = buildApp();
    // Starts 3 km away and climbs towards the search position, ending 1 km from it.
    const [start] = northOf(ORIGIN, -3000);
    if (start === undefined) {
      throw new Error('unreachable');
    }
    await uploadGpx(app, gpxTrack(straightNorth(start, 2000)), { name: 'Towards me' });

    const response = await searchNearby(app, { radius: 2000 });

    expect(response.body.ascents).toEqual([]);
  });

  it('returns at most 20 Ascents by default, and `limit` when given', async () => {
    const app = buildApp();
    for (let index = 0; index < 22; index += 1) {
      await ascentStartingNorth(app, `Ascent ${String(index)}`, 100 * index);
    }

    const byDefault = await searchNearby(app);
    const limited = await searchNearby(app, { limit: 3 });

    expect(byDefault.body.ascents).toHaveLength(20);
    expect(names(limited.body)).toEqual(['Ascent 0', 'Ascent 1', 'Ascent 2']);
  });

  it('answers an empty list when nothing is in range', async () => {
    const response = await searchNearby(buildApp());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ascents: [] });
  });

  it.each([
    ['a missing latitude', { latitude: '' }],
    ['a latitude above 90', { latitude: 90.5 }],
    ['a longitude below -180', { longitude: -181 }],
    ['a non-numeric longitude', { longitude: 'east' }],
    ['a zero radius', { radius: 0 }],
    ['a radius above 50 km', { radius: 50_001 }],
    ['a zero limit', { limit: 0 }],
    ['a limit above 100', { limit: 101 }],
    ['a fractional limit', { limit: 2.5 }],
  ])('refuses %s with VALIDATION_FAILED', async (_, query) => {
    const response = await searchNearby(buildApp(), query);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('accepts the largest radius and limit', async () => {
    const response = await searchNearby(buildApp(), { radius: 50_000, limit: 100 });

    expect(response.status).toBe(200);
  });

  it('is described in the OpenAPI document', async () => {
    const response = await request(buildApp()).get('/openapi.json');

    expect(response.body).toMatchObject({ paths: { '/ascents/nearby': { get: {} } } });
  });
});
