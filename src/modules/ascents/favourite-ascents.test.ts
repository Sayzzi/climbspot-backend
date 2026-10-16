import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { useAscentsApp, uploadGpx } from '../../../test/ascents-app.ts';
import { gpxTrack } from '../../../test/gpx.ts';
import { tokenFor, VISITOR_A, VISITOR_B } from '../../../test/identity.ts';
import { REFERENCE, straightNorth } from '../../../test/terrain.ts';
import type { Identity } from '../../shared/domain/identity.ts';

const buildApp = useAscentsApp();

const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';

const as = (visitor: Identity) => ({ Authorization: `Bearer ${tokenFor(visitor)}` });

async function anAscent(app: ReturnType<typeof buildApp>): Promise<string> {
  const response = await uploadGpx(app, gpxTrack(straightNorth(REFERENCE, 1000)));
  return response.body.id as string;
}

const favouriteOf = async (
  app: ReturnType<typeof buildApp>,
  id: string,
  visitor?: Identity,
): Promise<unknown> => {
  const call = request(app).get(`/ascents/${id}`);
  const { body } = await (visitor ? call.set(as(visitor)) : call);
  return (body as { favourite?: boolean }).favourite;
};

describe('PUT /ascents/{id}/favourite', () => {
  it('makes the Ascent one of the signed-in Visitor’s Favourite Ascents, theirs only', async () => {
    const app = buildApp();
    const id = await anAscent(app);

    const response = await request(app).put(`/ascents/${id}/favourite`).set(as(VISITOR_A));

    expect(response.status).toBe(204);
    expect(await favouriteOf(app, id, VISITOR_A)).toBe(true);
    expect(await favouriteOf(app, id, VISITOR_B)).toBe(false);
    expect(await favouriteOf(app, id)).toBeUndefined();
  });

  it('can be repeated', async () => {
    const app = buildApp();
    const id = await anAscent(app);

    await request(app).put(`/ascents/${id}/favourite`).set(as(VISITOR_A));
    const again = await request(app).put(`/ascents/${id}/favourite`).set(as(VISITOR_A));

    expect(again.status).toBe(204);
    expect(await favouriteOf(app, id, VISITOR_A)).toBe(true);
  });

  it('needs a signed-in Visitor', async () => {
    const app = buildApp();
    const id = await anAscent(app);

    expect((await request(app).put(`/ascents/${id}/favourite`)).status).toBe(401);
  });

  it('refuses an Ascent that does not exist', async () => {
    const response = await request(buildApp())
      .put(`/ascents/${UNKNOWN}/favourite`)
      .set(as(VISITOR_A));

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'ASCENT_NOT_FOUND' } });
  });
});

describe('DELETE /ascents/{id}/favourite', () => {
  it('takes the Ascent out of the Visitor’s Favourite Ascents, not others’', async () => {
    const app = buildApp();
    const id = await anAscent(app);
    await request(app).put(`/ascents/${id}/favourite`).set(as(VISITOR_A));
    await request(app).put(`/ascents/${id}/favourite`).set(as(VISITOR_B));

    const response = await request(app).delete(`/ascents/${id}/favourite`).set(as(VISITOR_A));

    expect(response.status).toBe(204);
    expect(await favouriteOf(app, id, VISITOR_A)).toBe(false);
    expect(await favouriteOf(app, id, VISITOR_B)).toBe(true);
  });

  it('accepts an Ascent that is not a favourite', async () => {
    const app = buildApp();
    const id = await anAscent(app);

    const response = await request(app).delete(`/ascents/${id}/favourite`).set(as(VISITOR_A));

    expect(response.status).toBe(204);
  });

  it('needs a signed-in Visitor', async () => {
    const app = buildApp();
    const id = await anAscent(app);

    expect((await request(app).delete(`/ascents/${id}/favourite`)).status).toBe(401);
  });
});

describe('Favourite Ascents in the nearby search', () => {
  const nearby = async (app: ReturnType<typeof buildApp>, visitor?: Identity) => {
    const call = request(app)
      .get('/ascents/nearby')
      .query({ latitude: REFERENCE.latitude, longitude: REFERENCE.longitude });
    const { body } = await (visitor ? call.set(as(visitor)) : call);
    return (body as { ascents: { id: string; favourite?: boolean }[] }).ascents;
  };

  it('says which results are the signed-in Visitor’s favourites, theirs only', async () => {
    const app = buildApp();
    const kept = await anAscent(app);
    const other = await anAscent(app);
    await request(app).put(`/ascents/${kept}/favourite`).set(as(VISITOR_A));

    const forA = await nearby(app, VISITOR_A);
    const forB = await nearby(app, VISITOR_B);
    const signedOut = await nearby(app);

    expect(forA.find((ascent) => ascent.id === kept)?.favourite).toBe(true);
    expect(forA.find((ascent) => ascent.id === other)?.favourite).toBe(false);
    expect(forB.every((ascent) => ascent.favourite === false)).toBe(true);
    expect(signedOut.every((ascent) => !('favourite' in ascent))).toBe(true);
  });
});

describe('Favourite Ascents in the OpenAPI document', () => {
  it('describes marking and unmarking, for signed-in Visitors', async () => {
    const { body } = await request(buildApp()).get('/openapi.json');
    const path = body.paths['/ascents/{id}/favourite'];

    expect(path.put.security).toEqual([{ bearerAuth: [] }]);
    expect(path.put.responses).toHaveProperty('204');
    expect(path.put.responses).toHaveProperty('404');
    expect(path.delete.security).toEqual([{ bearerAuth: [] }]);
    expect(body.components.schemas.Ascent.properties).toHaveProperty('favourite');
    expect(
      body.components.schemas.NearbyAscents.properties.ascents.items.properties,
    ).toHaveProperty('favourite');
  });
});
