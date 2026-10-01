import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { uploadGpx, useAscentsApp } from '../../../test/ascents-app.ts';
import { gpxTrack, type GpxPoint } from '../../../test/gpx.ts';
import { ORIGIN, straightNorth, terrainRisingNorth, uniformSlope } from '../../../test/terrain.ts';
import { ElevationUnavailableError, type ElevationProvider } from './domain/elevation-provider.ts';

const buildApp = useAscentsApp();

const oneKilometre = gpxTrack(straightNorth(ORIGIN, 1000));

async function catalogueIsEmpty(app: Express): Promise<boolean> {
  const response = await request(app)
    .get('/ascents/nearby')
    .query({ latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, radius: 50_000 });
  return response.body.ascents.length === 0;
}

async function expectRefusal(app: Express, gpx: string | Buffer, status: number, code: string) {
  const response = await uploadGpx(app, gpx);

  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({ error: { code } });
  expect(await catalogueIsEmpty(app)).toBe(true);
}

/**
 * Climbs at a steady rate over `length` metres to `gain`, with a Dip of `depth`
 * metres between 40 % and 50 % of the way. Smoothing softens the Dip: once
 * measured, depths 14, 18, 27 and 30 m become about 8.3, 11.7, 19.2 and 21.7 m.
 */
function terrainWithDip(length: number, gain: number, depth: number): ElevationProvider {
  const [dipStart, dipEnd] = [0.4 * length, 0.5 * length];
  const beforeDip = (gain * 0.4) / 0.9 + depth * (0.4 / 0.9);
  return terrainRisingNorth((north) => {
    if (north <= dipStart) {
      return (beforeDip / dipStart) * north;
    }
    if (north <= dipEnd) {
      return beforeDip - (depth * (north - dipStart)) / (dipEnd - dipStart);
    }
    const afterDip = beforeDip - depth;
    return afterDip + ((gain - afterDip) * (north - dipEnd)) / (length - dipEnd);
  });
}

describe('POST /ascents refusals: not an Ascent', () => {
  it('refuses a path flatter than 3 % with ASCENT_TOO_FLAT', async () => {
    await expectRefusal(
      buildApp({ terrain: uniformSlope(0.029) }),
      oneKilometre,
      422,
      'ASCENT_TOO_FLAT',
    );
  });

  it('accepts a path just steeper than 3 %', async () => {
    const response = await uploadGpx(buildApp({ terrain: uniformSlope(0.031) }), oneKilometre);

    expect(response.status).toBe(201);
  });

  it('refuses a path gaining less than 10 m with ASCENT_TOO_LOW', async () => {
    const twoHundredMetres = gpxTrack(straightNorth(ORIGIN, 200));

    await expectRefusal(
      buildApp({ terrain: uniformSlope(0.049) }),
      twoHundredMetres,
      422,
      'ASCENT_TOO_LOW',
    );
  });

  it('accepts a path gaining just over 10 m', async () => {
    const twoHundredMetres = gpxTrack(straightNorth(ORIGIN, 200));

    const response = await uploadGpx(buildApp({ terrain: uniformSlope(0.051) }), twoHundredMetres);

    expect(response.status).toBe(201);
  });

  it('refuses a path longer than 50 km with ASCENT_TOO_LONG', async () => {
    const tooLong = gpxTrack(straightNorth(ORIGIN, 50_100));

    await expectRefusal(buildApp({ terrain: uniformSlope(0.03) }), tooLong, 422, 'ASCENT_TOO_LONG');
  });

  it('accepts a path just shorter than 50 km', async () => {
    const response = await uploadGpx(
      buildApp({ terrain: uniformSlope(0.031) }),
      gpxTrack(straightNorth(ORIGIN, 49_900)),
    );

    expect(response.status).toBe(201);
  });
});

describe('POST /ascents refusals: Dips', () => {
  it('tolerates a Dip under 10 m on an Ascent gaining 50 m', async () => {
    const response = await uploadGpx(
      buildApp({ terrain: terrainWithDip(1000, 50, 14) }),
      oneKilometre,
    );

    expect(response.status).toBe(201);
  });

  it('refuses a Dip over 10 m on an Ascent gaining 50 m with ASCENT_DIP_TOO_LARGE', async () => {
    await expectRefusal(
      buildApp({ terrain: terrainWithDip(1000, 50, 18) }),
      oneKilometre,
      422,
      'ASCENT_DIP_TOO_LARGE',
    );
  });

  it('tolerates a Dip under 10 % of the Elevation Gain when that exceeds 10 m', async () => {
    const twoKilometres = gpxTrack(straightNorth(ORIGIN, 2000));

    const response = await uploadGpx(
      buildApp({ terrain: terrainWithDip(2000, 200, 27) }),
      twoKilometres,
    );

    expect(response.status).toBe(201);
  });

  it('refuses a Dip over 10 % of the Elevation Gain when that exceeds 10 m', async () => {
    const twoKilometres = gpxTrack(straightNorth(ORIGIN, 2000));

    await expectRefusal(
      buildApp({ terrain: terrainWithDip(2000, 200, 30) }),
      twoKilometres,
      422,
      'ASCENT_DIP_TOO_LARGE',
    );
  });
});

describe('POST /ascents refusals: files', () => {
  it.each([
    ['is not XML', 'this is not a GPX file <<<'],
    ['is XML but not GPX', '<?xml version="1.0"?><kml><Placemark/></kml>'],
    [
      'has a point without coordinates',
      gpxTrack([{ latitude: 45, longitude: 6 }]).replace('lon="6"', ''),
    ],
    [
      'has a point out of range',
      gpxTrack([
        { latitude: 95, longitude: 6 },
        { latitude: 45, longitude: 6 },
      ]),
    ],
  ])('refuses a file that %s with GPX_INVALID', async (_, gpx) => {
    await expectRefusal(buildApp(), gpx, 422, 'GPX_INVALID');
  });

  it.each([
    [
      'has no track or route',
      '<?xml version="1.0"?><gpx version="1.1"><wpt lat="45" lon="6"/></gpx>',
    ],
    ['has an empty track', gpxTrack([])],
    ['has a single point', gpxTrack([{ latitude: 45, longitude: 6 }])],
    [
      'repeats the same point',
      gpxTrack([
        { latitude: 45, longitude: 6 },
        { latitude: 45, longitude: 6 },
      ]),
    ],
  ])('refuses a file that %s with GPX_EMPTY', async (_, gpx) => {
    await expectRefusal(buildApp(), gpx, 422, 'GPX_EMPTY');
  });

  it('refuses a file larger than 5 MB with GPX_TOO_LARGE', async () => {
    await expectRefusal(buildApp(), Buffer.alloc(5 * 1024 * 1024 + 1, ' '), 413, 'GPX_TOO_LARGE');
  });

  it('refuses a path of more than 20,000 points with GPX_TOO_LARGE', async () => {
    const points: GpxPoint[] = straightNorth(ORIGIN, 1000, 20_001);

    await expectRefusal(buildApp(), gpxTrack(points), 413, 'GPX_TOO_LARGE');
  });

  it('accepts a path of exactly 20,000 points', async () => {
    const response = await uploadGpx(buildApp(), gpxTrack(straightNorth(ORIGIN, 1000, 20_000)));

    expect(response.status).toBe(201);
  });
});

describe('POST /ascents refusals: elevation service', () => {
  it('answers ELEVATION_UNAVAILABLE when the terrain model cannot be reached', async () => {
    const unreachable: ElevationProvider = {
      elevationsAt: () => Promise.reject(new ElevationUnavailableError('down')),
    };

    await expectRefusal(
      buildApp({ terrain: unreachable }),
      oneKilometre,
      503,
      'ELEVATION_UNAVAILABLE',
    );
  });
});

describe('POST /ascents refusals: fields', () => {
  const send = (app: Express, fields: Record<string, string>, withFile = true) => {
    const req = request(app).post('/ascents');
    for (const [name, value] of Object.entries(fields)) {
      void req.field(name, value);
    }
    return withFile
      ? req.attach('gpx', Buffer.from(oneKilometre), {
          filename: 'ascent.gpx',
          contentType: 'application/gpx+xml',
        })
      : req;
  };

  it.each([
    ['no name', { surface: 'paved' }],
    ['a blank name', { name: '   ', surface: 'paved' }],
    ['a name over 100 characters', { name: 'a'.repeat(101), surface: 'paved' }],
    ['no surface', { name: 'Côte' }],
    ['an unknown surface', { name: 'Côte', surface: 'asphalt' }],
  ])('refuses %s with VALIDATION_FAILED', async (_, fields) => {
    const app = buildApp();

    const response = await send(app, fields);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(await catalogueIsEmpty(app)).toBe(true);
  });

  it('refuses a request without a GPX file with VALIDATION_FAILED', async () => {
    const response = await send(buildApp(), { name: 'Côte', surface: 'paved' }, false);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('trims the name', async () => {
    const response = await send(buildApp(), { name: '  Le Mur  ', surface: 'paved' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Le Mur');
  });
});

describe('POST /ascents refusals: OpenAPI', () => {
  it('documents the refusal responses', async () => {
    const response = await request(buildApp()).get('/openapi.json');

    expect(Object.keys(response.body.paths['/ascents'].post.responses)).toEqual(
      expect.arrayContaining(['400', '403', '413', '422', '503']),
    );
  });
});
