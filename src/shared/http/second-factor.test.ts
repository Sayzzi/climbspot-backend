import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { useAccountsApp } from '../../../test/accounts-app.ts';
import { uploadGpx } from '../../../test/ascents-app.ts';
import { gpxTrack } from '../../../test/gpx.ts';
import {
  fakeSecondFactors,
  tokenFor,
  VISITOR_A,
  VISITOR_B,
  withSecondFactor,
} from '../../../test/identity.ts';
import { REFERENCE, straightNorth } from '../../../test/terrain.ts';
import type { Identity } from '../domain/identity.ts';

const buildApp = useAccountsApp();

const as = (visitor: Identity) => ({ Authorization: `Bearer ${tokenFor(visitor)}` });

const protectingAda = () => fakeSecondFactors({ protectedVisitors: [VISITOR_A] });

describe('A Visitor with a second factor', () => {
  it.each([
    ['get', '/me'],
    ['patch', '/me'],
    ['delete', '/me'],
    ['get', '/saved-itineraries'],
    ['post', '/ascents'],
  ] as const)(
    'needs a session that gave its code: %s %s answers SECOND_FACTOR_REQUIRED',
    async (method, path) => {
      const app = buildApp(protectingAda());

      const response = await request(app)[method](path).set(as(VISITOR_A)).send({});

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: { code: 'SECOND_FACTOR_REQUIRED' } });
    },
  );

  it('is served once their session gave the code', async () => {
    const app = buildApp(protectingAda());

    const response = await request(app)
      .get('/me')
      .set(as(withSecondFactor(VISITOR_A)));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ displayName: 'Ada' });
  });

  it('counts as nobody on public routes until the code is given', async () => {
    const app = buildApp(protectingAda());
    await uploadGpx(app, gpxTrack(straightNorth(REFERENCE, 1000)), {
      as: withSecondFactor(VISITOR_A),
    });

    const response = await request(app)
      .get(
        `/ascents/nearby?latitude=${String(REFERENCE.latitude)}&longitude=${String(REFERENCE.longitude)}`,
      )
      .set(as(VISITOR_A));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ascents: [expect.any(Object)] });
  });

  it('is refused when Supabase cannot tell whether they have one', async () => {
    const app = buildApp(fakeSecondFactors({ failing: true }));

    const response = await request(app).get('/me').set(as(VISITOR_A));

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { code: 'AUTHENTICATION_UNAVAILABLE' } });
  });

  it('is not asked about once the session gave the code', async () => {
    const factors = fakeSecondFactors({ failing: true });

    const response = await request(buildApp(factors))
      .get('/me')
      .set(as(withSecondFactor(VISITOR_A)));

    expect(response.status).toBe(200);
    expect(factors.asked).toEqual([]);
  });
});

describe('A Visitor without a second factor', () => {
  it('is served without any code', async () => {
    const response = await request(buildApp(protectingAda())).get('/me').set(as(VISITOR_B));

    expect(response.status).toBe(200);
  });

  it('is served as before when nobody can be checked', async () => {
    const response = await request(buildApp()).get('/me').set(as(VISITOR_A));

    expect(response.status).toBe(200);
  });
});

describe('The OpenAPI document', () => {
  it('says what a session without the code is answered', async () => {
    const { body } = await request(buildApp()).get('/openapi.json');

    const description = body.components.securitySchemes.bearerAuth.description as string;
    expect(description).toContain('SECOND_FACTOR_REQUIRED');
    expect(description).toContain('AUTHENTICATION_UNAVAILABLE');
  });
});
