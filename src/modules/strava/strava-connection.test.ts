import { sql } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { VISITOR_A, VISITOR_B } from '../../../test/identity.ts';
import { fakeStrava, STRAVA_CODES } from '../../../test/strava.ts';
import { as, connect, connectionOf, stateFor, useStravaApp } from '../../../test/strava-app.ts';

const buildApp = useStravaApp();

describe('Strava Connection', () => {
  it.each([
    ['get', '/strava/authorize'],
    ['get', '/strava/connection'],
    ['post', '/strava/connection'],
    ['delete', '/strava/connection'],
  ] as const)('needs a signed-in Visitor: %s %s', async (method, path) => {
    const response = await request(buildApp())[method](path);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
  });

  it('gives Strava’s authorisation URL with a state of the Visitor’s own', async () => {
    const app = buildApp();

    const response = await request(app).get('/strava/authorize').set(as(VISITOR_A));

    expect(response.status).toBe(200);
    expect((response.body as { url: string }).url).toMatch(
      /^https:\/\/strava\.test\/oauth\/authorize\?/,
    );
    const [mine, theirs] = [await stateFor(app, VISITOR_A), await stateFor(app, VISITOR_B)];
    expect(mine).not.toBe('');
    expect(mine).not.toBe(theirs);
  });

  it('is none until the Visitor connects', async () => {
    expect(await connectionOf(buildApp(), VISITOR_A)).toEqual({
      status: 'none',
      athlete: null,
      connectedAt: null,
      lastSyncAt: null,
      recordedRuns: 0,
    });
  });

  it('connects with the code Strava returns, and shows the athlete', async () => {
    const app = buildApp();

    const response = await connect(app, VISITOR_A);

    expect(response.status).toBe(200);
    const expected = {
      status: 'connected',
      athlete: { name: 'Ada Runner' },
      connectedAt: expect.any(String) as unknown,
      lastSyncAt: expect.any(String) as unknown,
      recordedRuns: 0,
    };
    expect(response.body).toEqual(expected);
    expect(await connectionOf(app, VISITOR_A)).toEqual(expected);
    expect(await connectionOf(app, VISITOR_B)).toMatchObject({ status: 'none' });
  });

  it('never gives the tokens, and keeps them encrypted', async () => {
    const app = buildApp();

    const response = await connect(app, VISITOR_A);

    expect(JSON.stringify(response.body)).not.toMatch(/access-|refresh-/);
    const rows = await buildApp.db().execute(sql`select * from strava_connections`);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toMatch(/access-1001|refresh-1001/);
  });

  it('refuses a state given to another Visitor', async () => {
    const app = buildApp();
    const theirs = await stateFor(app, VISITOR_B);

    const response = await request(app)
      .post('/strava/connection')
      .set(as(VISITOR_A))
      .send({ code: STRAVA_CODES.ada.code, state: theirs });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ error: { code: 'STRAVA_AUTHORIZATION_REFUSED' } });
    expect(await connectionOf(app, VISITOR_A)).toMatchObject({ status: 'none' });
  });

  it('refuses a code Strava does not accept', async () => {
    const response = await connect(buildApp(), VISITOR_A, 'expired-code');

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ error: { code: 'STRAVA_AUTHORIZATION_REFUSED' } });
  });

  it('says when Strava is unavailable', async () => {
    const response = await connect(
      buildApp({ gateway: fakeStrava({ down: true }).gateway }),
      VISITOR_A,
    );

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { code: 'STRAVA_UNAVAILABLE' } });
  });

  it('validates the code and state', async () => {
    const response = await request(buildApp())
      .post('/strava/connection')
      .set(as(VISITOR_A))
      .send({ code: '' });

    expect(response.status).toBe(400);
  });

  it('ends: revokes ClimbSpot at Strava and erases the connection', async () => {
    const strava = fakeStrava();
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);

    const response = await request(app).delete('/strava/connection').set(as(VISITOR_A));

    expect(response.status).toBe(204);
    expect(strava.revoked).toEqual(['access-1001-1']);
    expect(await connectionOf(app, VISITOR_A)).toMatchObject({ status: 'none' });
  });

  it('refreshes expired tokens before revoking them', async () => {
    const strava = fakeStrava({ tokensLastFor: -60 });
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);

    await request(app).delete('/strava/connection').set(as(VISITOR_A));

    // The tokens it grants are always expired: each use refreshes them first.
    expect(strava.refreshed.length).toBeGreaterThan(0);
    expect(strava.revoked).toEqual([`access-1001-${String(strava.refreshed.length + 1)}`]);
  });

  it('erases the connection even when Strava cannot be told', async () => {
    const strava = fakeStrava();
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);
    strava.control.down = true;

    const response = await request(app).delete('/strava/connection').set(as(VISITOR_A));

    expect(response.status).toBe(204);
    expect(await connectionOf(app, VISITOR_A)).toMatchObject({ status: 'none' });
  });

  it('ends with the account', async () => {
    const strava = fakeStrava();
    const app = buildApp({ gateway: strava.gateway });
    await connect(app, VISITOR_A);
    await connect(app, VISITOR_B, STRAVA_CODES.bob.code);

    expect((await request(app).delete('/me').set(as(VISITOR_A))).status).toBe(204);

    expect(strava.revoked).toEqual(['access-1001-1']);
    expect(await connectionOf(app, VISITOR_A)).toMatchObject({ status: 'none' });
    expect(await connectionOf(app, VISITOR_B)).toMatchObject({ status: 'connected' });
  });

  it('is described in the OpenAPI document', async () => {
    const { body } = await request(buildApp()).get('/openapi.json');

    expect(body.paths['/strava/connection'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(body.paths['/strava/authorize'].get.security).toEqual([{ bearerAuth: [] }]);
  });
});
