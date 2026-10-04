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
