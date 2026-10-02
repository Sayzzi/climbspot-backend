import { describe, expect, it } from 'vitest';

import { activities, type Activity } from '../../../shared/domain/activity.ts';
import { RoutingUnavailableError } from '../domain/routing-provider.ts';
import { OpenRouteServiceRoutingProvider } from './open-route-service-routing-provider.ts';

const baseUrl = 'https://routing.test';
const apiKey = 'test-key';

interface Sent {
  readonly url: string;
  readonly authorization: string | null;
  readonly body: Record<string, unknown>;
}

/** A fake OpenRouteService answering a straight two-point route of 1,234 m. */
function fakeOpenRouteService(sent: Sent[] = [], answer?: () => Response): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    sent.push({
      url: request.url,
      authorization: request.headers.get('Authorization'),
      body: (await request.json()) as Record<string, unknown>,
    });
    return (
      answer?.() ??
      Response.json({
        features: [
          {
            geometry: {
              coordinates: [
                [6, 45, 200],
                [6.01, 45.01, 260],
              ],
            },
            properties: { summary: { distance: 1234 } },
          },
        ],
      })
    );
  };
}

const noWait = () => Promise.resolve();

describe('OpenRouteServiceRoutingProvider', () => {
  it('routes through positions and returns the path with its elevations', async () => {
    const sent: Sent[] = [];
    const provider = new OpenRouteServiceRoutingProvider({
      apiKey,
      baseUrl,
      fetch: fakeOpenRouteService(sent),
    });

    const routed = await provider.routeThrough(
      [
        { latitude: 45, longitude: 6 },
        { latitude: 45.01, longitude: 6.01 },
      ],
      'running',
    );

    expect(routed).toEqual({
      length: 1234,
      points: [
        { position: { latitude: 45, longitude: 6 }, elevation: 200 },
        { position: { latitude: 45.01, longitude: 6.01 }, elevation: 260 },
      ],
    });
    expect(sent[0]?.url).toBe(`${baseUrl}/v2/directions/foot-walking/geojson`);
    expect(sent[0]?.authorization).toBe(apiKey);
    expect(sent[0]?.body).toMatchObject({
      coordinates: [
        [6, 45],
        [6.01, 45.01],
      ],
      elevation: true,
    });
  });

  it.each<[Activity, string]>([
    ['running', 'foot-walking'],
    ['trail_running', 'foot-hiking'],
    ['road_cycling', 'cycling-road'],
    ['gravel_cycling', 'cycling-regular'],
    ['mountain_biking', 'cycling-mountain'],
  ])('routes %s with the %s profile', async (activity, profile) => {
    const sent: Sent[] = [];
    const provider = new OpenRouteServiceRoutingProvider({
      apiKey,
      baseUrl,
      fetch: fakeOpenRouteService(sent),
    });

    await provider.routeThrough(
      [
        { latitude: 45, longitude: 6 },
        { latitude: 45.01, longitude: 6 },
      ],
      activity,
    );

    expect(sent[0]?.url).toBe(`${baseUrl}/v2/directions/${profile}/geojson`);
  });

  it('knows a routing profile for every Activity', () => {
    expect(activities).toHaveLength(5);
  });

  it('asks for a round trip of a given length and variant', async () => {
    const sent: Sent[] = [];
    const provider = new OpenRouteServiceRoutingProvider({
      apiKey,
      baseUrl,
      fetch: fakeOpenRouteService(sent),
    });

    await provider.roundTrip({ latitude: 45, longitude: 6 }, 7500, 'trail_running', 3);

    expect(sent[0]?.url).toBe(`${baseUrl}/v2/directions/foot-hiking/geojson`);
    expect(sent[0]?.body).toMatchObject({
      coordinates: [[6, 45]],
      elevation: true,
      options: { round_trip: { length: 7500, seed: 3 } },
    });
  });

  it('answers nothing when no way can be found near the positions', async () => {
    const provider = new OpenRouteServiceRoutingProvider({
      apiKey,
      baseUrl,
      fetch: fakeOpenRouteService([], () =>
        Response.json(
          { error: { code: 2010, message: 'Could not find routable point' } },
          { status: 404 },
        ),
      ),
    });

    await expect(
      provider.roundTrip({ latitude: 45, longitude: 6 }, 5000, 'running', 1),
    ).resolves.toBeUndefined();
  });

  it('waits and retries when rate limited', async () => {
    let calls = 0;
    const waits: number[] = [];
    const provider = new OpenRouteServiceRoutingProvider({
      apiKey,
      baseUrl,
      fetch: fakeOpenRouteService([], () => {
        calls += 1;
        return calls === 1
          ? new Response('', { status: 429 })
          : Response.json({
              features: [
                {
                  geometry: {
                    coordinates: [
                      [6, 45, 1],
                      [6, 45.01, 2],
                    ],
                  },
                  properties: { summary: { distance: 10 } },
                },
              ],
            });
      }),
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });

    await expect(
      provider.roundTrip({ latitude: 45, longitude: 6 }, 5000, 'running', 1),
    ).resolves.toMatchObject({ length: 10 });
    expect(waits).toEqual([1000]);
  });

  const failures: [string, () => Response][] = [
    ['keeps being rate limited', () => new Response('', { status: 429 })],
    ['answers a server error', () => new Response('', { status: 500 })],
    [
      'rejects the key',
      () => Response.json({ error: 'Access to this API has been disallowed' }, { status: 403 }),
    ],
    ['answers an unreadable body', () => new Response('<html>')],
    ['answers no route', () => Response.json({ features: [] })],
  ];

  it.each(failures)('reports routing as unavailable when the API %s', async (_, answer) => {
    const provider = new OpenRouteServiceRoutingProvider({
      apiKey,
      baseUrl,
      fetch: fakeOpenRouteService([], answer),
      sleep: noWait,
    });

    const result = provider.roundTrip({ latitude: 45, longitude: 6 }, 5000, 'running', 1);

    await expect(result).rejects.toBeInstanceOf(RoutingUnavailableError);
    await expect(result).rejects.toMatchObject({
      code: 'ROUTING_UNAVAILABLE',
      kind: 'unavailable',
    });
  });

  it('reports routing as unavailable when the network fails', async () => {
    const provider = new OpenRouteServiceRoutingProvider({
      apiKey,
      baseUrl,
      fetch: () => Promise.reject(new TypeError('fetch failed')),
    });

    await expect(
      provider.routeThrough([{ latitude: 45, longitude: 6 }], 'running'),
    ).rejects.toBeInstanceOf(RoutingUnavailableError);
  });

  it('reports routing as unavailable when the API is too slow', async () => {
    const hanging: typeof fetch = (_, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      });
    const provider = new OpenRouteServiceRoutingProvider({
      apiKey,
      baseUrl,
      fetch: hanging,
      timeoutMs: 20,
    });

    await expect(
      provider.roundTrip({ latitude: 45, longitude: 6 }, 5000, 'running', 1),
    ).rejects.toBeInstanceOf(RoutingUnavailableError);
  });
});
