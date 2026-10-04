import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { uploadGpx } from '../../../test/ascents-app.ts';
import { gpxTrack } from '../../../test/gpx.ts';
import { VISITOR_A, VISITOR_B } from '../../../test/identity.ts';
import { anOuting, fakeStrava, runNorth, STRAVA_CODES } from '../../../test/strava.ts';
import { as, connect, useStravaApp } from '../../../test/strava-app.ts';
import {
  METRES_PER_DEGREE_OF_LATITUDE,
  northOf,
  REFERENCE,
  straightNorth,
} from '../../../test/terrain.ts';
import type { Position } from '../../shared/domain/position.ts';
import type { TrackSample } from './index.ts';

const buildApp = useStravaApp();

const ADA = STRAVA_CODES.ada.athlete.id;

type App = ReturnType<typeof buildApp>;

/** The Ascent every test goes up: 1 km due north of REFERENCE, Start to Top. */
async function addAscent(app: App): Promise<string> {
  const response = await uploadGpx(app, gpxTrack(straightNorth(REFERENCE, 1000)), {
    as: VISITOR_B,
  });
  return response.body.id as string;
}

const south = (metres: number): Position => ({
  latitude: REFERENCE.latitude - metres / METRES_PER_DEGREE_OF_LATITUDE,
  longitude: REFERENCE.longitude,
});

/** Joins legs of samples into one recording, distances and times carried on. */
function recording(...legs: TrackSample[][]): TrackSample[] {
  const joined: TrackSample[] = [];
  for (const leg of legs) {
    const last = joined.at(-1);
    joined.push(
      ...leg.slice(last ? 1 : 0).map((sample) => ({
        ...sample,
        distance: sample.distance + (last?.distance ?? 0),
        elapsed: sample.elapsed + (last?.elapsed ?? 0),
      })),
    );
  }
  return joined;
}

/** Samples going from one position to the next, `spacing` metres apart, at a steady pace. */
function legThrough(positions: Position[], secondsPerKm = 300, spacing = 5): TrackSample[] {
  const samples: TrackSample[] = [];
  let distance = 0;
  positions.forEach((to, index) => {
    const from = positions[index - 1];
    if (!from) {
      samples.push({ ...to, altitude: 200, distance: 0, elapsed: 0, moving: true });
      return;
    }
    const dLat = (to.latitude - from.latitude) * METRES_PER_DEGREE_OF_LATITUDE;
    const dLon =
      (to.longitude - from.longitude) *
      METRES_PER_DEGREE_OF_LATITUDE *
      Math.cos((from.latitude * Math.PI) / 180);
    const length = Math.hypot(dLat, dLon);
    const steps = Math.max(1, Math.round(length / spacing));
    for (let step = 1; step <= steps; step += 1) {
      const fraction = step / steps;
      distance += length / steps;
      samples.push({
        latitude: from.latitude + (to.latitude - from.latitude) * fraction,
        longitude: from.longitude + (to.longitude - from.longitude) * fraction,
        altitude: 200,
        distance,
        elapsed: (distance / 1000) * secondsPerKm,
        moving: true,
      });
    }
  });
  return samples;
}

/** Metres east of a position. */
const east = (from: Position, metres: number): Position => ({
  latitude: from.latitude,
  longitude:
    from.longitude +
    metres / (METRES_PER_DEGREE_OF_LATITUDE * Math.cos((from.latitude * Math.PI) / 180)),
});

const nearbyFor = async (app: App, visitor?: typeof VISITOR_A) => {
  const call = request(app).get(
    `/ascents/nearby?latitude=${String(REFERENCE.latitude)}&longitude=${String(REFERENCE.longitude)}`,
  );
  const response = visitor ? await call.set(as(visitor)) : await call;
  return (response.body as { ascents: Record<string, unknown>[] }).ascents;
};

const myTimes = async (app: App, ascentId: string, visitor = VISITOR_A) =>
  (await request(app).get(`/ascents/${ascentId}/my-times`).set(as(visitor))).body as {
    ascentTimes: { startedAt: string; seconds: number }[];
  };

async function runAfterAscent(samples: TrackSample[]) {
  const strava = fakeStrava({ outings: { [ADA]: [anOuting({ daysAgo: 2, samples })] } });
  const app = buildApp({ gateway: strava.gateway });
  const ascentId = await addAscent(app);
  await connect(app, VISITOR_A);
  return { app, ascentId, strava };
}

/** From 200 m below the Start to 200 m beyond the Top, at `secondsPerKm`. */
const upTheAscent = (secondsPerKm = 300) =>
  runNorth(1400, { from: south(200), secondsPerKm, spacing: 5 });

describe('Ascent Times', () => {
  it('are found when a Recorded Run goes up an Ascent from its Start to its Top', async () => {
    const { app, ascentId } = await runAfterAscent(upTheAscent(300));

    const [found] = await nearbyFor(app, VISITOR_A);
    expect(found).toMatchObject({ id: ascentId, myAscentTimes: { best: 300, count: 1 } });
    const { ascentTimes } = await myTimes(app, ascentId);
    expect(ascentTimes).toEqual([{ startedAt: expect.any(String) as unknown, seconds: 300 }]);
  });

  it('count each repeat up, not the way down', async () => {
    const up = (secondsPerKm: number) =>
      legThrough([south(50), ...northOf(REFERENCE, 1050)], secondsPerKm);
    const down = legThrough([...northOf(REFERENCE, 1050), south(50)], 300);
    const { app, ascentId } = await runAfterAscent(recording(up(360), down, up(330)));

    const [found] = await nearbyFor(app, VISITOR_A);
    expect(found).toMatchObject({ myAscentTimes: { best: 330, count: 2 } });
    const { ascentTimes } = await myTimes(app, ascentId);
    expect(ascentTimes.map((time) => time.seconds)).toEqual([330, 360]);
  });

  it.each([
    [
      'only crosses it',
      legThrough([
        east(northOf(REFERENCE, 500)[0] ?? REFERENCE, -300),
        east(northOf(REFERENCE, 500)[0] ?? REFERENCE, 300),
      ]),
    ],
    ['goes down it', legThrough([...northOf(REFERENCE, 1200), south(200)])],
    [
      'cuts its middle',
      legThrough([
        south(100),
        ...northOf(REFERENCE, 350),
        east(northOf(REFERENCE, 350)[0] ?? REFERENCE, 150),
        east(northOf(REFERENCE, 650)[0] ?? REFERENCE, 150),
        ...northOf(REFERENCE, 650, 1100),
      ]),
    ],
    ['stops before its Top', runNorth(900, { from: south(200), spacing: 5 })],
  ])('are not found for a run that %s', async (_, samples) => {
    const { app, ascentId } = await runAfterAscent(samples);

    const [found] = await nearbyFor(app, VISITOR_A);
    expect(found).not.toHaveProperty('myAscentTimes');
    expect((await myTimes(app, ascentId)).ascentTimes).toEqual([]);
  });

  it('are found in past Recorded Runs for an Ascent added later', async () => {
    const strava = fakeStrava({
      outings: { [ADA]: [anOuting({ daysAgo: 2, samples: upTheAscent(300) })] },
    });
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);

    const ascentId = await addAscent(app);

    expect((await myTimes(app, ascentId)).ascentTimes).toMatchObject([{ seconds: 300 }]);
  });

  it('are shown to nobody else, and leave responses unchanged without a token', async () => {
    const { app, ascentId } = await runAfterAscent(upTheAscent(300));

    expect((await nearbyFor(app))[0]).not.toHaveProperty('myAscentTimes');
    expect((await nearbyFor(app, VISITOR_B))[0]).not.toHaveProperty('myAscentTimes');
    expect((await myTimes(app, ascentId, VISITOR_B)).ascentTimes).toEqual([]);
    expect((await request(app).get(`/ascents/${ascentId}/my-times`)).status).toBe(401);
  });

  it('are erased when the connection ends', async () => {
    const { app, ascentId } = await runAfterAscent(upTheAscent(300));

    await request(app).delete('/strava/connection').set(as(VISITOR_A));

    expect((await myTimes(app, ascentId)).ascentTimes).toEqual([]);
  });

  it('answer 404 for an unknown Ascent', async () => {
    const response = await request(buildApp())
      .get('/ascents/00000000-0000-4000-8000-000000000999/my-times')
      .set(as(VISITOR_A));

    expect(response.status).toBe(404);
  });

  it('are described in the OpenAPI document', async () => {
    const { body } = await request(buildApp()).get('/openapi.json');

    expect(body.paths['/ascents/{id}/my-times'].get.security).toEqual([{ bearerAuth: [] }]);
  });
});
