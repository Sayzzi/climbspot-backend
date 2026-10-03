import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { Identity } from '../../shared/domain/identity.ts';
import { tokenFor, VISITOR_A, VISITOR_B } from '../../../test/identity.ts';
import { aHillSession, aLoop, anUphillItinerary } from '../../../test/proposals.ts';
import { useSavedItinerariesApp } from '../../../test/saved-itineraries-app.ts';

const buildApp = useSavedItinerariesApp();

const as = (visitor: Identity) => ({ Authorization: `Bearer ${tokenFor(visitor)}` });

describe('Saved Itineraries', () => {
  it('need a signed-in Visitor', async () => {
    const app = buildApp();

    for (const call of [
      request(app).get('/saved-itineraries'),
      request(app).post('/saved-itineraries').send({ name: 'Loop', proposal: aLoop() }),
    ]) {
      const response = await call;
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
    }
  });

  it.each([
    ['a Loop', aLoop()],
    ['an Uphill Itinerary', anUphillItinerary()],
    ['a Hill Session', aHillSession()],
  ])('keeps %s exactly as proposed', async (_, proposal) => {
    const app = buildApp();

    const saved = await request(app)
      .post('/saved-itineraries')
      .set(as(VISITOR_A))
      .send({ name: '  Sunday hills  ', proposal });

    expect(saved.status).toBe(201);
    expect(saved.body).toMatchObject({ name: 'Sunday hills', kind: proposal.kind });
    const read = await request(app)
      .get(`/saved-itineraries/${saved.body.id as string}`)
      .set(as(VISITOR_A));
    expect(read.body).toMatchObject({ name: 'Sunday hills', proposal });
  });

  it('lists the Visitor’s own, newest first, with their length', async () => {
    const app = buildApp();
    for (const [name, proposal] of [
      ['First', aLoop()],
      ['Second', aHillSession()],
    ] as const) {
      await request(app).post('/saved-itineraries').set(as(VISITOR_A)).send({ name, proposal });
    }

    const response = await request(app).get('/saved-itineraries').set(as(VISITOR_A));

    expect(response.body.savedItineraries).toEqual([
      expect.objectContaining({ name: 'Second', kind: 'session', length: 8400 }),
      expect.objectContaining({ name: 'First', kind: 'loop', length: 5600 }),
    ]);
    expect(response.body.savedItineraries[0]).not.toHaveProperty('proposal');
  });

  it('renames and deletes', async () => {
    const app = buildApp();
    const { body } = await request(app)
      .post('/saved-itineraries')
      .set(as(VISITOR_A))
      .send({ name: 'Loop', proposal: aLoop() });
    const at = `/saved-itineraries/${body.id as string}`;

    const renamed = await request(app).patch(at).set(as(VISITOR_A)).send({ name: 'Lakeside' });
    expect(renamed.body).toMatchObject({ name: 'Lakeside' });

    expect((await request(app).delete(at).set(as(VISITOR_A))).status).toBe(204);
    expect((await request(app).get(at).set(as(VISITOR_A))).status).toBe(404);
  });

  it('never lets another Visitor list or reach them', async () => {
    const app = buildApp();
    const { body } = await request(app)
      .post('/saved-itineraries')
      .set(as(VISITOR_A))
      .send({ name: 'Mine', proposal: aLoop() });
    const at = `/saved-itineraries/${body.id as string}`;

    expect((await request(app).get('/saved-itineraries').set(as(VISITOR_B))).body).toEqual({
      savedItineraries: [],
    });
    for (const response of [
      await request(app).get(at).set(as(VISITOR_B)),
      await request(app).patch(at).set(as(VISITOR_B)).send({ name: 'Taken' }),
      await request(app).delete(at).set(as(VISITOR_B)),
    ]) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: { code: 'SAVED_ITINERARY_NOT_FOUND' } });
    }
    expect((await request(app).get(at).set(as(VISITOR_A))).body).toMatchObject({ name: 'Mine' });
  });

  it.each([
    ['no name', { proposal: aLoop() }],
    ['a blank name', { name: '  ', proposal: aLoop() }],
    ['a name over 100 characters', { name: 'x'.repeat(101), proposal: aLoop() }],
    ['an unknown kind of proposal', { name: 'X', proposal: { ...aLoop(), kind: 'tour' } }],
    ['a proposal missing its path', { name: 'X', proposal: { ...aLoop(), path: undefined } }],
  ])('refuses %s', async (_, body) => {
    const response = await request(buildApp())
      .post('/saved-itineraries')
      .set(as(VISITOR_A))
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('refuses a proposal too large to keep', async () => {
    const coordinates = Array.from({ length: 30_000 }, (_, index) => [6, 45 + index / 1e6]);
    const response = await request(buildApp())
      .post('/saved-itineraries')
      .set(as(VISITOR_A))
      .send({ name: 'Huge', proposal: { ...aLoop(), path: { type: 'LineString', coordinates } } });

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ error: { code: 'SAVED_ITINERARY_TOO_LARGE' } });
  });

  it('is described in the OpenAPI document', async () => {
    const { body } = await request(buildApp()).get('/openapi.json');

    expect(body.paths['/saved-itineraries'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(body.paths['/saved-itineraries/{id}']).toMatchObject({
      get: {},
      patch: {},
      delete: {},
    });
  });
});
