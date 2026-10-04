import { sql } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { VISITOR_A, VISITOR_B } from '../../../test/identity.ts';
import { anOuting, fakeStrava, runNorth, STRAVA_CODES } from '../../../test/strava.ts';
import { as, connect, connectionOf, useStravaApp } from '../../../test/strava-app.ts';
import type { Identity } from '../../shared/domain/identity.ts';

const buildApp = useStravaApp();

const ADA = STRAVA_CODES.ada.athlete.id;
const BOB = STRAVA_CODES.bob.athlete.id;

type App = ReturnType<typeof buildApp>;

const sync = (app: App, visitor: Identity) => request(app).post('/strava/sync').set(as(visitor));

const storedRuns = () =>
  buildApp.db().execute<{
    strava_id: string;
    distance: number;
    track: { latitude: number; elapsed: number; moving: number }[];
  }>(sql`select strava_id, distance, track from recorded_runs order by started_at`);

describe('Importing Recorded Runs', () => {
  it('imports the runs and trail runs of the last three months on connecting', async () => {
    const run = anOuting({ daysAgo: 10 });
    const trailRun = anOuting({ daysAgo: 80, sport: 'TrailRun' });
    const strava = fakeStrava({
      outings: {
        [ADA]: [
          run,
          trailRun,
          anOuting({ daysAgo: 5, sport: 'Ride' }),
          anOuting({ daysAgo: 3, sport: 'Swim' }),
          anOuting({ daysAgo: 100 }),
        ],
      },
    });
    const app = buildApp({ gateway: strava.gateway });

    const response = await connect(app, VISITOR_A);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'connected',
      recordedRuns: 2,
      lastSyncAt: expect.any(String) as unknown,
    });
    expect((await storedRuns()).map((stored) => Number(stored.strava_id))).toEqual([
      trailRun.id,
      run.id,
    ]);
    expect(strava.tracksRead.toSorted()).toEqual([run.id, trailRun.id].toSorted());
  });

  it('keeps each Recorded Run’s track, simplified to about 10 m', async () => {
    const strava = fakeStrava({
      outings: { [ADA]: [anOuting({ samples: runNorth(1000, { spacing: 2 }) })] },
    });

    await connect(buildApp({ gateway: strava.gateway }), VISITOR_A);

    const [stored] = await storedRuns();
    expect(stored?.distance).toBe(1000);
    expect(stored?.track.length).toBeGreaterThanOrEqual(95);
    expect(stored?.track.length).toBeLessThanOrEqual(105);
    expect(stored?.track.at(-1)).toMatchObject({ elapsed: 300, moving: 300 });
  });

  it('leaves stops out of the moving time', async () => {
    const before = runNorth(500);
    const stop = before.at(-1);
    if (!stop) throw new Error('samples expected');
    // Standing still for two minutes halfway, then the second half.
    const standing = [30, 60, 90, 120].map((seconds) => ({
      ...stop,
      elapsed: stop.elapsed + seconds,
      moving: false,
    }));
    const after = runNorth(500, {
      from: { latitude: stop.latitude, longitude: stop.longitude },
    }).map((sample) => ({
      ...sample,
      distance: sample.distance + 500,
      elapsed: sample.elapsed + stop.elapsed + 120,
    }));
    const strava = fakeStrava({
      outings: { [ADA]: [anOuting({ samples: [...before, ...standing, ...after.slice(1)] })] },
    });

    await connect(buildApp({ gateway: strava.gateway }), VISITOR_A);

    const [stored] = await storedRuns();
    expect(stored?.track.at(-1)).toMatchObject({ elapsed: 420, moving: 300 });
  });

  it('synchronises only what is new', async () => {
    const strava = fakeStrava({ outings: { [ADA]: [anOuting({ daysAgo: 5 })] } });
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);
    const fresh = anOuting({ daysAgo: 0 });
    strava.control.outings[ADA]?.push(fresh);

    const response = await sync(app, VISITOR_A);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ recordedRuns: 2 });
    expect(strava.tracksRead).toHaveLength(2);
    expect(strava.tracksRead.at(-1)).toBe(fresh.id);

    await sync(app, VISITOR_A);
    expect(strava.tracksRead).toHaveLength(2);
    expect(await storedRuns()).toHaveLength(2);
  });

  it('stops at Strava’s limits, keeping what was imported, and carries on later', async () => {
    const outings = [3, 2, 1].map((daysAgo) => anOuting({ daysAgo }));
    const strava = fakeStrava({ outings: { [ADA]: outings } });
    const app = buildApp({ gateway: strava.gateway });
    // The exchange, the list and one track, then the limits are reached.
    strava.control.requestsLeft = 3;

    const connected = await connect(app, VISITOR_A);

    expect(connected.status).toBe(200);
    // Not synchronised in full: the Visitor can be told the import carries on.
    expect(connected.body).toMatchObject({
      status: 'connected',
      recordedRuns: 1,
      lastSyncAt: null,
    });

    const limited = await sync(app, VISITOR_A);
    expect(limited.status).toBe(503);
    expect(limited.body).toMatchObject({ error: { code: 'STRAVA_UNAVAILABLE' } });

    strava.control.requestsLeft = undefined;
    const resumed = await sync(app, VISITOR_A);

    expect(resumed.body).toMatchObject({ recordedRuns: 3 });
    expect(strava.tracksRead.toSorted()).toEqual(outings.map((outing) => outing.id).toSorted());
  });

  it('refreshes expired tokens to synchronise', async () => {
    const strava = fakeStrava({ tokensLastFor: -60, outings: { [ADA]: [anOuting()] } });
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);

    const response = await sync(app, VISITOR_A);

    expect(response.status).toBe(200);
    expect(strava.refreshed.length).toBeGreaterThan(0);
  });

  it('says the connection was lost when the Visitor withdrew ClimbSpot at Strava', async () => {
    const strava = fakeStrava({ outings: { [ADA]: [anOuting()] } });
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);
    strava.control.withdrawn.add(ADA);

    const response = await sync(app, VISITOR_A);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: { code: 'STRAVA_CONNECTION_LOST' } });
    expect(await connectionOf(app, VISITOR_A)).toMatchObject({ status: 'lost', recordedRuns: 1 });

    expect((await connect(app, VISITOR_A)).body).toMatchObject({ status: 'connected' });
  });

  it('has nothing to synchronise without a connection', async () => {
    const response = await sync(buildApp(), VISITOR_A);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'none', recordedRuns: 0 });
  });

  it('keeps each Visitor’s Recorded Runs apart', async () => {
    const strava = fakeStrava({
      outings: { [ADA]: [anOuting(), anOuting()], [BOB]: [anOuting()] },
    });
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);
    await connect(app, VISITOR_B, STRAVA_CODES.bob.code);

    expect(await connectionOf(app, VISITOR_A)).toMatchObject({ recordedRuns: 2 });
    expect(await connectionOf(app, VISITOR_B)).toMatchObject({ recordedRuns: 1 });
  });

  it('erases the Recorded Runs when the connection ends, or the account goes', async () => {
    const strava = fakeStrava({ outings: { [ADA]: [anOuting()], [BOB]: [anOuting()] } });
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);
    await connect(app, VISITOR_B, STRAVA_CODES.bob.code);

    await request(app).delete('/strava/connection').set(as(VISITOR_A));
    expect(await storedRuns()).toHaveLength(1);

    await request(app).delete('/me').set(as(VISITOR_B));
    expect(await storedRuns()).toHaveLength(0);
  });

  it('is described in the OpenAPI document', async () => {
    const { body } = await request(buildApp()).get('/openapi.json');

    expect(body.paths['/strava/sync'].post.security).toEqual([{ bearerAuth: [] }]);
  });
});
