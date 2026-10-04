import { describe, expect, it } from 'vitest';

import { StravaApiGateway } from './strava-api-gateway.ts';

function gateway(answer: () => Response | Promise<Response>) {
  const sent: Request[] = [];
  const subject = new StravaApiGateway({
    clientId: '250132',
    clientSecret: 'client-secret',
    redirectUrl: 'http://localhost:5173/strava/callback',
    fetch: (input, init) => {
      sent.push(new Request(input, init));
      return Promise.resolve(answer());
    },
  });
  return { subject, sent };
}

const grant = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_at: 1_790_000_000,
  athlete: { id: 42, firstname: 'Ada', lastname: 'Runner' },
};

describe('StravaApiGateway', () => {
  it('sends Visitors to Strava to read all their outings, then back with the state', () => {
    const url = new URL(gateway(() => new Response()).subject.authorizationUrl('the-state'));

    expect(url.origin + url.pathname).toBe('https://www.strava.com/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: '250132',
      redirect_uri: 'http://localhost:5173/strava/callback',
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'read,activity:read_all',
      state: 'the-state',
    });
  });

  it('exchanges a code for the athlete and their tokens', async () => {
    const { subject, sent } = gateway(() => Response.json(grant));

    const result = await subject.exchange('the-code');

    expect(result).toEqual({
      athlete: { id: 42, name: 'Ada Runner' },
      tokens: {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: new Date(1_790_000_000_000),
      },
    });
    expect(sent[0]?.url).toBe('https://www.strava.com/oauth/token');
    expect(Object.fromEntries(new URLSearchParams(await sent[0]?.text()))).toEqual({
      client_id: '250132',
      client_secret: 'client-secret',
      grant_type: 'authorization_code',
      code: 'the-code',
    });
  });

  it('refuses a code Strava does not accept', async () => {
    await expect(
      gateway(() => new Response(null, { status: 400 })).subject.exchange('bad'),
    ).rejects.toMatchObject({ code: 'STRAVA_AUTHORIZATION_REFUSED' });
  });

  it('refreshes tokens, and says when Strava no longer accepts them', async () => {
    const { subject, sent } = gateway(() => Response.json(grant));

    expect((await subject.refresh('old-refresh')).accessToken).toBe('access');
    expect(new URLSearchParams(await sent[0]?.text()).get('grant_type')).toBe('refresh_token');
    await expect(
      gateway(() => new Response(null, { status: 400 })).subject.refresh('revoked'),
    ).rejects.toMatchObject({ code: 'STRAVA_CONNECTION_LOST' });
  });

  it('revokes with the access token, counting an already revoked one as done', async () => {
    const { subject, sent } = gateway(() => new Response('{}'));

    await subject.revoke('access');

    expect(sent[0]?.url).toBe('https://www.strava.com/oauth/deauthorize');
    expect(sent[0]?.headers.get('Authorization')).toBe('Bearer access');
    await expect(
      gateway(() => new Response(null, { status: 401 })).subject.revoke('gone'),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['its limits are reached', () => new Response(null, { status: 429 })],
    ['it fails', () => new Response(null, { status: 503 })],
    ['it cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
  ])('is unavailable when %s', async (_, answer) => {
    await expect(gateway(answer).subject.exchange('code')).rejects.toMatchObject({
      code: 'STRAVA_UNAVAILABLE',
    });
  });
});

describe('StravaApiGateway, reading outings', () => {
  const outing = (id: number, start: string, sport = 'Run') => ({
    id,
    type: sport,
    sport_type: sport,
    start_date: start,
    distance: 5000,
    moving_time: 1500,
  });

  it('lists every outing since a date, page by page, oldest first', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) =>
      outing(index + 2, '2026-09-02T07:00:00Z'),
    );
    const pages = [firstPage, [outing(1, '2026-09-01T07:00:00Z', 'TrailRun')]];
    const { subject, sent } = gateway(() => Response.json(pages.shift() ?? []));

    const outings = await subject.outingsSince('access', new Date('2026-07-01T00:00:00Z'));

    expect(outings).toHaveLength(201);
    expect(outings[0]).toEqual({
      id: 1,
      sport: 'TrailRun',
      startedAt: new Date('2026-09-01T07:00:00Z'),
      distance: 5000,
      movingTime: 1500,
    });
    const first = new URL(sent[0]?.url ?? '');
    expect(first.pathname).toBe('/api/v3/athlete/activities');
    expect(first.searchParams.get('after')).toBe(String(Date.parse('2026-07-01T00:00:00Z') / 1000));
    expect(new URL(sent[1]?.url ?? '').searchParams.get('page')).toBe('2');
    expect(sent[0]?.headers.get('Authorization')).toBe('Bearer access');
  });

  it('reads an outing’s readings from its streams', async () => {
    const { subject, sent } = gateway(() =>
      Response.json({
        latlng: {
          data: [
            [45, 6],
            [45.001, 6],
          ],
        },
        altitude: { data: [200, 201] },
        distance: { data: [0, 111] },
        time: { data: [0, 30] },
        moving: { data: [false, true] },
      }),
    );

    expect(await subject.track('access', 7)).toEqual([
      { latitude: 45, longitude: 6, altitude: 200, distance: 0, elapsed: 0, moving: false },
      { latitude: 45.001, longitude: 6, altitude: 201, distance: 111, elapsed: 30, moving: true },
    ]);
    expect(new URL(sent[0]?.url ?? '').pathname).toBe('/api/v3/activities/7/streams');
  });

  it('gives no readings for an outing recorded without positions', async () => {
    expect(
      await gateway(() => Response.json({ time: { data: [0] } })).subject.track('a', 7),
    ).toEqual([]);
    expect(await gateway(() => new Response(null, { status: 404 })).subject.track('a', 7)).toEqual(
      [],
    );
  });

  it('says the connection is lost when Strava no longer accepts the token', async () => {
    await expect(
      gateway(() => new Response(null, { status: 401 })).subject.outingsSince('a', new Date()),
    ).rejects.toMatchObject({ code: 'STRAVA_CONNECTION_LOST' });
  });
});
