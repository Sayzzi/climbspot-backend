import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { useAscentsApp, uploadGpx as upload } from '../../../test/ascents-app.ts';
import { gpxRoute, gpxTrack } from '../../../test/gpx.ts';
import {
  northOf,
  REFERENCE,
  straightNorth,
  terrainRisingNorth,
  uniformGradient,
} from '../../../test/terrain.ts';

const buildApp = useAscentsApp();

describe('POST /ascents', () => {
  it('creates an Ascent and computes its measurements from the terrain', async () => {
    const response = await upload(buildApp(), gpxTrack(straightNorth(REFERENCE, 1000)), {
      name: 'Côte de test',
      surface: 'paved',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Côte de test',
      surface: 'paved',
      start: { latitude: 45, longitude: 6, elevation: 200 },
      top: { longitude: 6, elevation: 280 },
    });
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.length).toBeCloseTo(1000, 0);
    expect(response.body.elevationGain).toBeCloseTo(80, 1);
    expect(response.body.averageGradient).toBeCloseTo(0.08, 3);
    expect(response.body.maximumGradient).toBeCloseTo(0.08, 3);
    expect(response.body.difficultyScore).toBeCloseTo(8000, -1);
  });
});

describe('POST /ascents measurements', () => {
  it('measures the maximum Gradient on the steepest stretch', async () => {
    // 500 m at 5 %, then 500 m at 12 %.
    const terrain = terrainRisingNorth((north) =>
      north <= 500 ? 200 + 0.05 * north : 225 + 0.12 * (north - 500),
    );

    const response = await upload(buildApp({ terrain }), gpxTrack(straightNorth(REFERENCE, 1000)));

    expect(response.status).toBe(201);
    expect(response.body.elevationGain).toBeCloseTo(85, 1);
    expect(response.body.averageGradient).toBeCloseTo(0.085, 3);
    expect(response.body.maximumGradient).toBeCloseTo(0.12, 3);
  });

  it('turns a path recorded downhill the right way up', async () => {
    const downhill = straightNorth(REFERENCE, 1000).toReversed();

    const response = await upload(buildApp(), gpxTrack(downhill));

    expect(response.status).toBe(201);
    expect(response.body.start).toEqual({ latitude: 45, longitude: 6, elevation: 200 });
    expect(response.body.top.elevation).toBeCloseTo(280, 1);
    expect(response.body.elevationGain).toBeCloseTo(80, 1);
    expect(response.body.path.coordinates[0]).toEqual([6, 45]);
  });

  it('ignores the elevations recorded in the file', async () => {
    const noisy = straightNorth(REFERENCE, 1000).map((position, index) => ({
      ...position,
      elevation: index % 2 === 0 ? 5000 : -300,
    }));

    const response = await upload(buildApp(), gpxTrack(noisy));

    expect(response.body.elevationGain).toBeCloseTo(80, 1);
    expect(response.body.maximumGradient).toBeCloseTo(0.08, 3);
  });

  it('measures the same Ascent whatever the density of the recorded points', async () => {
    const sparse = await upload(buildApp(), gpxTrack(straightNorth(REFERENCE, 1000, 3)));
    const dense = await upload(buildApp(), gpxTrack(straightNorth(REFERENCE, 1000, 400)));

    expect(sparse.body.length).toBeCloseTo(dense.body.length as number, 0);
    // Sampled every 100 m, close to the terrain model's resolution.
    expect(sparse.body.elevationProfile).toHaveLength(11);
    expect(dense.body.elevationProfile).toHaveLength(11);
  });

  it.each([
    [0.079, 'uncategorized'],
    [0.081, 'cat4'],
    [0.159, 'cat4'],
    [0.161, 'cat3'],
  ])('puts 1 km at a %s Gradient in the %s Category', async (gradient, category) => {
    const response = await upload(
      buildApp({ terrain: uniformGradient(gradient) }),
      gpxTrack(straightNorth(REFERENCE, 1000)),
    );

    expect(response.body.category).toBe(category);
  });

  it.each([
    [4000, 0.081, 'cat2'],
    [8000, 0.081, 'cat1'],
    [10_000, 0.081, 'hc'],
  ])('puts %s m at a %s Gradient in the %s Category', async (length, gradient, category) => {
    const response = await upload(
      buildApp({ terrain: uniformGradient(gradient) }),
      gpxTrack(straightNorth(REFERENCE, length)),
    );

    expect(response.body.category).toBe(category);
  });
});

describe('POST /ascents Surfaces and Activities', () => {
  it.each([
    ['paved', ['running', 'road_cycling']],
    ['gravel', ['running', 'trail_running', 'gravel_cycling', 'mountain_biking']],
    ['trail', ['trail_running', 'mountain_biking']],
  ])('derives the Activities of a %s Ascent from its Surface', async (surface, activities) => {
    const response = await upload(buildApp(), gpxTrack(straightNorth(REFERENCE, 1000)), {
      surface,
    });

    expect(response.body.surface).toBe(surface);
    expect(response.body.activities).toEqual(activities);
  });
});

describe('POST /ascents path shape', () => {
  /** 450 m north, then 500 m east: a corner between two 100 m samples. */
  function cornerPath() {
    const [corner] = northOf(REFERENCE, 450);
    if (corner === undefined) {
      throw new Error('unreachable');
    }
    const metresPerDegreeOfLongitude = 111_195.08 * Math.cos((corner.latitude * Math.PI) / 180);
    const east = (metres: number) => ({
      latitude: corner.latitude,
      longitude: corner.longitude + metres / metresPerDegreeOfLongitude,
    });
    return { corner, points: [REFERENCE, corner, east(250), east(500)] };
  }

  it('keeps the shape of the uploaded path for the map, corners included', async () => {
    const { corner, points } = cornerPath();

    const response = await upload(buildApp(), gpxTrack(points));

    expect(response.status).toBe(201);
    const [, second] = response.body.path.coordinates as [number, number][];
    expect(second?.[0]).toBeCloseTo(corner.longitude, 6);
    expect(second?.[1]).toBeCloseTo(corner.latitude, 6);
  });

  it('still measures on samples every 100 m', async () => {
    const response = await upload(buildApp(), gpxTrack(cornerPath().points));

    expect(response.body.elevationProfile).toHaveLength(11);
    expect(response.body.length).toBeCloseTo(950, 0);
  });

  it('drops points that do not change the shape', async () => {
    const response = await upload(buildApp(), gpxTrack(straightNorth(REFERENCE, 1000, 400)));

    expect(response.body.path.coordinates).toHaveLength(2);
  });

  it('returns the same path when the Ascent is read back', async () => {
    const app = buildApp();
    const created = await upload(app, gpxTrack(cornerPath().points));

    const read = await request(app).get(`/ascents/${created.body.id as string}`);

    expect(read.body.path).toEqual(created.body.path);
    expect(read.body.elevationProfile).toEqual(created.body.elevationProfile);
  });
});

describe('POST /ascents GPX files', () => {
  it('joins all the segments of the first track', async () => {
    const [first, second] = [northOf(REFERENCE, 0, 250, 500), northOf(REFERENCE, 500, 750, 1000)];

    const response = await upload(buildApp(), gpxTrack(first, second));

    expect(response.body.length).toBeCloseTo(1000, 0);
  });

  it('falls back to the first route when the file has no track', async () => {
    const response = await upload(buildApp(), gpxRoute(straightNorth(REFERENCE, 600)));

    expect(response.status).toBe(201);
    expect(response.body.length).toBeCloseTo(600, 0);
  });
});

describe('POST /ascents Difficulty Score', () => {
  it('reports an integer Difficulty Score consistent with its Category', async () => {
    // 1 km at 8 % sits exactly on the Cat 4 threshold of 8,000.
    const response = await upload(buildApp(), gpxTrack(straightNorth(REFERENCE, 1000)));

    expect(response.body.difficultyScore).toBe(8000);
    expect(response.body.category).toBe('cat4');
  });
});

describe('POST /ascents creation guard', () => {
  it('refuses to create Ascents when creation is disabled', async () => {
    const app = buildApp({ creationEnabled: false });

    const response = await upload(app, gpxTrack(straightNorth(REFERENCE, 1000)));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: { code: 'ASCENT_CREATION_DISABLED' } });
  });

  it('refuses before reading the request when creation is disabled', async () => {
    const app = buildApp({ creationEnabled: false });

    const response = await request(app).post('/ascents').field('surface', 'asphalt');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: { code: 'ASCENT_CREATION_DISABLED' } });
  });
});

describe('GET /ascents/:id', () => {
  it('returns a created Ascent with its path and Elevation Profile', async () => {
    const app = buildApp();
    const created = await upload(app, gpxTrack(straightNorth(REFERENCE, 1000)), { name: 'Le Mur' });

    const response = await request(app).get(`/ascents/${created.body.id as string}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created.body);
    expect(response.body).toMatchObject({ name: 'Le Mur', path: { type: 'LineString' } });
    expect(response.body.path.coordinates[0]).toEqual([6, 45]);
    expect(response.body.elevationProfile[0]).toEqual({ distance: 0, elevation: 200 });
    expect(response.body.elevationProfile.at(-1).distance).toBeCloseTo(1000, 0);
    expect(response.body.elevationProfile.at(-1).elevation).toBeCloseTo(280, 1);
  });

  it('answers ASCENT_NOT_FOUND for an unknown id', async () => {
    const response = await request(buildApp()).get('/ascents/5f0c2f8e-9a51-4e43-8b8f-0d6c5c3f6a11');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'ASCENT_NOT_FOUND' } });
  });

  it('answers VALIDATION_FAILED for a malformed id', async () => {
    const response = await request(buildApp()).get('/ascents/not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });
});

describe('OpenAPI document', () => {
  it('describes the Ascent endpoints', async () => {
    const response = await request(buildApp()).get('/openapi.json');

    expect(response.body).toMatchObject({
      paths: { '/ascents': { post: {} }, '/ascents/{id}': { get: {} } },
      components: { schemas: { Ascent: {} } },
    });
  });
});
