import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { VISITOR_A, VISITOR_B } from '../../../test/identity.ts';
import { anOuting, fakeStrava, runNorth, STRAVA_CODES } from '../../../test/strava.ts';
import { as, connect, useStravaApp } from '../../../test/strava-app.ts';
import type { Identity } from '../../shared/domain/identity.ts';

const buildApp = useStravaApp();

const ADA = STRAVA_CODES.ada.athlete.id;

type App = ReturnType<typeof buildApp>;

const me = async (app: App, visitor: Identity = VISITOR_A) =>
  (await request(app).get('/me').set(as(visitor))).body as Record<string, unknown>;

/** Flat runs of `kilometres` each, at `secondsPerKm`. */
const flatRuns = (count: number, kilometres: number, secondsPerKm = 300) =>
  Array.from({ length: count }, (_, index) =>
    anOuting({
      daysAgo: index + 1,
      samples: runNorth(kilometres * 1000, { secondsPerKm, spacing: 5 }),
    }),
  );

async function connected(outings: ReturnType<typeof anOuting>[]) {
  const strava = fakeStrava({ outings: { [ADA]: outings } });
  const app = buildApp({ gateway: strava.gateway });
  await connect(app, VISITOR_A);
  return { app, strava };
}

describe('Flat Pace from Strava', () => {
  it('comes from the flat stretches of the Recorded Runs', async () => {
    const { app } = await connected(flatRuns(3, 4));

    expect(await me(app)).toMatchObject({ flatPace: 300, flatPaceSource: 'strava' });
  });

  it('is the median over the flat stretches, hills left out', async () => {
    const { app } = await connected([
      ...flatRuns(2, 3, 300),
      anOuting({ daysAgo: 3, samples: runNorth(5000, { secondsPerKm: 310, spacing: 5 }) }),
      anOuting({
        daysAgo: 4,
        samples: runNorth(8000, { secondsPerKm: 420, spacing: 5, gradient: 0.04 }),
      }),
      anOuting({
        daysAgo: 5,
        samples: runNorth(8000, { secondsPerKm: 240, spacing: 5, gradient: -0.04 }),
      }),
    ]);

    expect(await me(app)).toMatchObject({ flatPace: 300, flatPaceSource: 'strava' });
  });

  it('leaves stops out', async () => {
    const withStop = (daysAgo: number) => {
      const samples = runNorth(4000, { spacing: 5 });
      // Five minutes standing at every kilometre.
      let stopped = 0;
      return anOuting({
        daysAgo,
        samples: samples.flatMap((sample) => {
          const shifted = { ...sample, elapsed: sample.elapsed + stopped };
          if (sample.distance === 0 || sample.distance % 1000 !== 0) {
            return [shifted];
          }
          stopped += 300;
          return [shifted, { ...shifted, elapsed: shifted.elapsed + 300, moving: false }];
        }),
      });
    };

    const { app } = await connected([withStop(1), withStop(2), withStop(3)]);

    expect(await me(app)).toMatchObject({ flatPace: 300 });
  });

  it('is none with fewer than 10 km of flat stretches', async () => {
    const { app } = await connected(flatRuns(2, 4));

    expect(await me(app)).toMatchObject({ flatPace: null, flatPaceSource: null });
  });

  it('follows each synchronisation', async () => {
    const { app, strava } = await connected(flatRuns(2, 4));
    strava.control.outings[ADA]?.push(
      anOuting({ daysAgo: 0, samples: runNorth(4000, { secondsPerKm: 300, spacing: 5 }) }),
    );

    await request(app).post('/strava/sync').set(as(VISITOR_A));

    expect(await me(app)).toMatchObject({ flatPace: 300, flatPaceSource: 'strava' });
  });

  it('gives way to a stated Flat Pace, until the Visitor reverts to Strava’s', async () => {
    const { app } = await connected(flatRuns(3, 4));

    const stated = await request(app).patch('/me').set(as(VISITOR_A)).send({ flatPace: 330 });
    expect(stated.body).toMatchObject({ flatPace: 330, flatPaceSource: 'stated' });
    expect(await me(app)).toMatchObject({ flatPace: 330, flatPaceSource: 'stated' });

    const reverted = await request(app).patch('/me').set(as(VISITOR_A)).send({ flatPace: null });
    expect(reverted.body).toMatchObject({ flatPace: 300, flatPaceSource: 'strava' });
  });

  it('is erased with the connection; a stated one stays', async () => {
    const { app } = await connected(flatRuns(3, 4));

    await request(app).delete('/strava/connection').set(as(VISITOR_A));
    expect(await me(app)).toMatchObject({ flatPace: null, flatPaceSource: null });

    await request(app).patch('/me').set(as(VISITOR_A)).send({ flatPace: 330 });
    await connect(app, VISITOR_A);
    await request(app).delete('/strava/connection').set(as(VISITOR_A));
    expect(await me(app)).toMatchObject({ flatPace: 330, flatPaceSource: 'stated' });
  });

  it('is each Visitor’s own', async () => {
    const { app } = await connected(flatRuns(3, 4));

    expect(await me(app, VISITOR_B)).toMatchObject({ flatPace: null, flatPaceSource: null });
  });
});
