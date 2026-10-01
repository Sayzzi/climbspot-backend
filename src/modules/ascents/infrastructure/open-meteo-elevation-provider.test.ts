import { describe, expect, it } from 'vitest';

import { ElevationUnavailableError } from '../domain/elevation-provider.ts';
import type { Position } from '../domain/position.ts';
import { OpenMeteoElevationProvider } from './open-meteo-elevation-provider.ts';

const baseUrl = 'https://elevation.test/v1/elevation';

/** A fake Open-Meteo whose terrain rises 1 m per 0.001° of latitude. */
function fakeOpenMeteo(requests: URL[] = []): typeof fetch {
  return (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    requests.push(url);
    const latitudes = (url.searchParams.get('latitude') ?? '').split(',').map(Number);
    const elevation = latitudes.map((latitude) => Math.round((latitude - 45) * 1000));
    return Promise.resolve(Response.json({ elevation }));
  };
}

function positionsAlongMeridian(count: number): Position[] {
  return Array.from({ length: count }, (_, index) => ({
    latitude: 45 + index / 1000,
    longitude: 6,
  }));
}

describe('OpenMeteoElevationProvider', () => {
  it('returns one elevation per position, in input order', async () => {
    const provider = new OpenMeteoElevationProvider({ baseUrl, fetch: fakeOpenMeteo() });

    const elevations = await provider.elevationsAt([
      { latitude: 45.003, longitude: 6 },
      { latitude: 45.001, longitude: 6 },
      { latitude: 45.002, longitude: 6 },
    ]);

    expect(elevations).toEqual([3, 1, 2]);
  });

  it('sends latitudes and longitudes as comma-separated lists', async () => {
    const requests: URL[] = [];
    const provider = new OpenMeteoElevationProvider({ baseUrl, fetch: fakeOpenMeteo(requests) });

    await provider.elevationsAt([
      { latitude: 45.5, longitude: 6.25 },
      { latitude: 45.75, longitude: 6.5 },
    ]);

    expect(requests).toHaveLength(1);
    expect(`${requests[0]?.origin ?? ''}${requests[0]?.pathname ?? ''}`).toBe(baseUrl);
    expect(requests[0]?.searchParams.get('latitude')).toBe('45.5,45.75');
    expect(requests[0]?.searchParams.get('longitude')).toBe('6.25,6.5');
  });

  it('splits more than 100 positions into several requests and keeps their order', async () => {
    const requests: URL[] = [];
    const provider = new OpenMeteoElevationProvider({ baseUrl, fetch: fakeOpenMeteo(requests) });

    const elevations = await provider.elevationsAt(positionsAlongMeridian(250));

    expect(requests.map((url) => url.searchParams.get('latitude')?.split(',').length)).toEqual([
      100, 100, 50,
    ]);
    expect(elevations).toHaveLength(250);
    expect(elevations.slice(98, 102)).toEqual([98, 99, 100, 101]);
    expect(elevations.at(-1)).toBe(249);
  });

  it('does not call the API for an empty list', async () => {
    const requests: URL[] = [];
    const provider = new OpenMeteoElevationProvider({ baseUrl, fetch: fakeOpenMeteo(requests) });

    await expect(provider.elevationsAt([])).resolves.toEqual([]);
    expect(requests).toHaveLength(0);
  });

  const failures: [string, typeof fetch][] = [
    ['the network fails', () => Promise.reject(new TypeError('fetch failed'))],
    ['the API answers an error status', () => Promise.resolve(new Response('', { status: 429 }))],
    ['the body is not JSON', () => Promise.resolve(new Response('<html>'))],
    ['the body has no elevations', () => Promise.resolve(Response.json({ reason: 'oops' }))],
    ['an elevation is missing', () => Promise.resolve(Response.json({ elevation: [12] }))],
    [
      'an elevation is not a number',
      () => Promise.resolve(Response.json({ elevation: [1, null] })),
    ],
  ];

  it.each(failures)('reports the elevation as unavailable when %s', async (_, failingFetch) => {
    const provider = new OpenMeteoElevationProvider({ baseUrl, fetch: failingFetch });

    const result = provider.elevationsAt(positionsAlongMeridian(2));

    await expect(result).rejects.toBeInstanceOf(ElevationUnavailableError);
    await expect(result).rejects.toMatchObject({
      code: 'ELEVATION_UNAVAILABLE',
      kind: 'unavailable',
    });
  });

  it('reports the elevation as unavailable when the API is too slow', async () => {
    const hangingFetch: typeof fetch = (_, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      });
    const provider = new OpenMeteoElevationProvider({
      baseUrl,
      fetch: hangingFetch,
      timeoutMs: 20,
    });

    await expect(provider.elevationsAt(positionsAlongMeridian(2))).rejects.toBeInstanceOf(
      ElevationUnavailableError,
    );
  });
});
