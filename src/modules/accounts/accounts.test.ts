import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { useAccountsApp } from '../../../test/accounts-app.ts';
import { tokenFor, VISITOR_A, VISITOR_B } from '../../../test/identity.ts';

const buildApp = useAccountsApp();

const me = (token?: string) => {
  const call = request(buildApp()).get('/me');
  return token === undefined ? call : call.set('Authorization', `Bearer ${token}`);
};

const updateMe = (token: string, body: Record<string, unknown>) =>
  request(buildApp()).patch('/me').set('Authorization', `Bearer ${token}`).send(body);

describe('GET /me', () => {
  it.each([
    ['without a token', undefined],
    ['with a token that is not valid', 'forged'],
  ])('needs a signed-in Visitor: %s', async (_, token) => {
    const response = await me(token);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
  });

  it('creates the account on first use, named after the identity', async () => {
    const response = await me(tokenFor(VISITOR_A));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      displayName: 'Ada',
      email: 'ada@example.com',
      flatPace: null,
      flatPaceSource: null,
    });
  });

  it('names an account after its e-mail when the identity has no name', async () => {
    const response = await me(tokenFor(VISITOR_B));

    expect(response.body).toMatchObject({ displayName: 'bob' });
  });

  it('shows the e-mail the identity has now', async () => {
    await me(tokenFor(VISITOR_A));

    const response = await me(tokenFor({ ...VISITOR_A, email: 'ada@new.example' }));

    expect(response.body).toMatchObject({ displayName: 'Ada', email: 'ada@new.example' });
  });
});

describe('PATCH /me', () => {
  it('changes the display name and the Flat Pace, kept for later', async () => {
    await updateMe(tokenFor(VISITOR_A), { displayName: 'Ada L.', flatPace: 330 });

    const response = await me(tokenFor(VISITOR_A));

    expect(response.body).toMatchObject({ displayName: 'Ada L.', flatPace: 330 });
  });

  it('clears the Flat Pace', async () => {
    await updateMe(tokenFor(VISITOR_A), { flatPace: 330 });
    await updateMe(tokenFor(VISITOR_A), { flatPace: null });

    expect((await me(tokenFor(VISITOR_A))).body).toMatchObject({ flatPace: null });
  });

  it('keeps each Visitor to their own account', async () => {
    await updateMe(tokenFor(VISITOR_A), { displayName: 'Ada L.' });

    expect((await me(tokenFor(VISITOR_B))).body).toMatchObject({ displayName: 'bob' });
  });

  it.each([
    ['a Flat Pace faster than 3:00 per km', { flatPace: 170 }],
    ['a Flat Pace slower than 12:00 per km', { flatPace: 730 }],
    ['an empty display name', { displayName: '  ' }],
    ['a display name over 60 characters', { displayName: 'x'.repeat(61) }],
  ])('refuses %s', async (_, body) => {
    const response = await updateMe(tokenFor(VISITOR_A), body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('needs a signed-in Visitor', async () => {
    const response = await request(buildApp()).patch('/me').send({ displayName: 'Eve' });

    expect(response.status).toBe(401);
  });
});

describe('OpenAPI', () => {
  it('describes /me behind bearer authentication', async () => {
    const response = await request(buildApp()).get('/openapi.json');

    expect(response.body.components.securitySchemes).toMatchObject({
      bearerAuth: { type: 'http', scheme: 'bearer' },
    });
    expect(response.body.paths['/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(response.body.paths['/me'].patch).toBeDefined();
  });
});
