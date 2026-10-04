import { sql } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { fakeAccountDirectory, useAccountsApp } from '../../../test/accounts-app.ts';
import { uploadGpx } from '../../../test/ascents-app.ts';
import { gpxTrack } from '../../../test/gpx.ts';
import { tokenFor, VISITOR_A, VISITOR_B } from '../../../test/identity.ts';
import { aLoop } from '../../../test/proposals.ts';
import { REFERENCE, straightNorth } from '../../../test/terrain.ts';
import type { Identity } from '../../shared/domain/identity.ts';

const buildApp = useAccountsApp();

const as = (visitor: Identity) => ({ Authorization: `Bearer ${tokenFor(visitor)}` });

const saveLoop = (app: ReturnType<typeof buildApp>, visitor: Identity) =>
  request(app)
    .post('/saved-itineraries')
    .set(as(visitor))
    .send({ name: 'Loop', proposal: aLoop() });

const savedOf = async (app: ReturnType<typeof buildApp>, visitor: Identity) =>
  (
    (await request(app).get('/saved-itineraries').set(as(visitor))).body as {
      savedItineraries: unknown[];
    }
  ).savedItineraries;

const contributorOf = async (ascentId: string) =>
  (
    await buildApp.db().execute<{
      contributor: string | null;
    }>(sql`select contributor_id as contributor from ascents where id = ${ascentId}`)
  )[0]?.contributor;

describe('DELETE /me', () => {
  it('needs a signed-in Visitor', async () => {
    expect((await request(buildApp()).delete('/me')).status).toBe(401);
  });

  it('erases the account and its Saved Itineraries, and deletes the Supabase user', async () => {
    const { directory, deleted } = fakeAccountDirectory();
    const app = buildApp({ directory });
    await request(app)
      .patch('/me')
      .set(as(VISITOR_A))
      .send({ displayName: 'Ada L.', flatPace: 330 });
    await saveLoop(app, VISITOR_A);

    const response = await request(app).delete('/me').set(as(VISITOR_A));

    expect(response.status).toBe(204);
    expect(deleted).toEqual([VISITOR_A.visitorId]);
    expect(await savedOf(app, VISITOR_A)).toEqual([]);
    // Signing in again starts afresh.
    expect((await request(app).get('/me').set(as(VISITOR_A))).body).toEqual({
      displayName: 'Ada',
      email: 'ada@example.com',
      flatPace: null,
    });
  });

  it('keeps the Ascents the Visitor added, without any link to them', async () => {
    const app = buildApp();
    const added = await uploadGpx(app, gpxTrack(straightNorth(REFERENCE, 1000)), { as: VISITOR_A });

    await request(app).delete('/me').set(as(VISITOR_A));

    expect((await request(app).get(`/ascents/${added.body.id as string}`)).status).toBe(200);
    const rows = await buildApp
      .db()
      .execute<{ count: number }>(
        sql`select count(*)::int as count from ascents where contributor_id is not null`,
      );
    expect(rows[0]?.count).toBe(0);
  });

  it('leaves other Visitors’ data alone', async () => {
    const app = buildApp();
    await saveLoop(app, VISITOR_B);
    const theirs = await uploadGpx(app, gpxTrack(straightNorth(REFERENCE, 1000)), {
      as: VISITOR_B,
    });

    await request(app).delete('/me').set(as(VISITOR_A));

    expect(await savedOf(app, VISITOR_B)).toHaveLength(1);
    expect(await contributorOf(theirs.body.id as string)).toBe(VISITOR_B.visitorId);
  });

  it('changes nothing when the Supabase user cannot be deleted', async () => {
    const app = buildApp({ directory: fakeAccountDirectory({ failing: true }).directory });
    const added = await uploadGpx(app, gpxTrack(straightNorth(REFERENCE, 1000)), { as: VISITOR_A });
    await request(app).patch('/me').set(as(VISITOR_A)).send({ flatPace: 330 });
    await saveLoop(app, VISITOR_A);

    const response = await request(app).delete('/me').set(as(VISITOR_A));

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { code: 'ACCOUNT_DELETION_UNAVAILABLE' } });
    expect(await savedOf(app, VISITOR_A)).toHaveLength(1);
    expect((await request(app).get('/me').set(as(VISITOR_A))).body).toMatchObject({
      flatPace: 330,
    });
    expect(await contributorOf(added.body.id as string)).toBe(VISITOR_A.visitorId);
  });

  it('keeps the Supabase user, and everything else, when erasing fails', async () => {
    const { directory, deleted } = fakeAccountDirectory();
    const app = buildApp({
      directory,
      alsoErase: [() => ({ erase: () => Promise.reject(new Error('the database went away')) })],
    });
    await saveLoop(app, VISITOR_A);

    const response = await request(app).delete('/me').set(as(VISITOR_A));

    expect(response.status).toBe(500);
    expect(deleted).toEqual([]);
    expect(await savedOf(app, VISITOR_A)).toHaveLength(1);
  });

  it('is described in the OpenAPI document', async () => {
    const { body } = await request(buildApp()).get('/openapi.json');

    expect(body.paths['/me'].delete.security).toEqual([{ bearerAuth: [] }]);
  });
});
