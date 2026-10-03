import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { uploadGpx, useAscentsApp } from '../../../test/ascents-app.ts';
import { flatEquivalent } from '../../../test/effort.ts';
import { gpxTrack } from '../../../test/gpx.ts';
import { REFERENCE, straightNorth, terrainRisingNorth } from '../../../test/terrain.ts';

const buildApp = useAscentsApp();

describe('Effort of an Ascent', () => {
  it('measures the Km-Effort and the Flat-Equivalent Distance on a uniform Gradient', async () => {
    // The default terrain rises 8 % northwards: 1 km gains 80 m.
    const response = await uploadGpx(buildApp(), gpxTrack(straightNorth(REFERENCE, 1000)));

    expect(response.status).toBe(201);
    expect(response.body.heightGained).toBeCloseTo(80, 0);
    expect(response.body.effort.kmEffort).toBe(1.8);
    // 1,000 m × C(8 %) / C(0) by Minetti.
    expect(response.body.effort.flatEquivalentDistance).toBeCloseTo(1509, -1);
  });

  it('counts every rise, and a descent as at best 10 % faster than the flat', async () => {
    // Up 8 % for 1 km, down 4 % for 300 m (a 12 m Dip, within the allowance), up 8 % for 1 km.
    const terrain = terrainRisingNorth((north) =>
      north <= 1000
        ? 200 + 0.08 * north
        : north <= 1300
          ? 280 - 0.04 * (north - 1000)
          : 268 + 0.08 * (north - 1300),
    );

    const response = await uploadGpx(
      buildApp({ terrain }),
      gpxTrack(straightNorth(REFERENCE, 2300, 24)),
    );

    expect(response.status).toBe(201);
    const { heightGained, elevationGain, length, effort, elevationProfile } = response.body as {
      heightGained: number;
      elevationGain: number;
      length: number;
      effort: { kmEffort: number; flatEquivalentDistance: number };
      elevationProfile: { distance: number; elevation: number }[];
    };
    expect(heightGained).toBeGreaterThan(elevationGain + 2);
    expect(effort.kmEffort).toBeCloseTo(length / 1000 + heightGained / 100, 1);
    expect(effort.flatEquivalentDistance).toBeCloseTo(flatEquivalent(elevationProfile, 0.9), 0);
    // The floor matters here: without it the descent would count for much less.
    expect(flatEquivalent(elevationProfile, 0.9)).toBeGreaterThan(
      flatEquivalent(elevationProfile, 0) + 5,
    );
  });

  it('is given in nearby searches too', async () => {
    const app = buildApp();
    const created = await uploadGpx(app, gpxTrack(straightNorth(REFERENCE, 1000)));

    const response = await request(app)
      .get('/ascents/nearby')
      .query({ latitude: REFERENCE.latitude, longitude: REFERENCE.longitude });

    expect(response.body.ascents[0]).toMatchObject({
      heightGained: created.body.heightGained,
      effort: created.body.effort,
    });
  });

  it('is described in the OpenAPI document', async () => {
    const response = await request(buildApp()).get('/openapi.json');

    const { Ascent, Effort } = response.body.components.schemas;
    expect(Ascent.properties).toHaveProperty('heightGained');
    expect(Ascent.properties.effort).toEqual({ $ref: '#/components/schemas/Effort' });
    expect(Effort.properties).toMatchObject({
      kmEffort: expect.any(Object) as unknown,
      flatEquivalentDistance: expect.any(Object) as unknown,
    });
  });
});
