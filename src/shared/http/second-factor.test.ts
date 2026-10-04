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
import { rememberedSecondFactors } from '../infrastructure/remembered-second-factors.ts';

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
    ['get', '/ascents/00000000-0000-4000-8000-000000000001/my-times'],
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

describe('Asking who has a second factor', () => {
  it('happens once a minute per Visitor, not on every request', async () => {
    const factors = protectingAda();
    const app = buildApp({ secondFactors: rememberedSecondFactors(factors.secondFactors) });

    await request(app).get('/me').set(as(VISITOR_A));
    await request(app).get('/saved-itineraries').set(as(VISITOR_A));

    expect(factors.asked).toEqual([VISITOR_A.visitorId]);
  });
});

describe('The OpenAPI document', () => {
  it('says what a session without the code is answered, route by route', async () => {
    const { body } = await request(buildApp()).get('/openapi.json');

    const description = body.components.securitySchemes.bearerAuth.description as string;
    expect(description).toContain('SECOND_FACTOR_REQUIRED');
    const { responses } = body.paths['/me'].delete;
    expect(responses['401'].description).toContain('SECOND_FACTOR_REQUIRED');
    expect(responses['503'].description).toContain('ACCOUNT_DELETION_UNAVAILABLE');
    expect(responses['503'].description).toContain('AUTHENTICATION_UNAVAILABLE');
    expect(body.paths['/saved-itineraries'].get.responses['503'].description).toContain(
      'AUTHENTICATION_UNAVAILABLE',
    );
  });
});
