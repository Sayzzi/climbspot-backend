import { z } from 'zod';

import {
  ElevationUnavailableError,
  type ElevationProvider,
  type Position,
} from '../domain/elevation-provider.ts';

/** Open-Meteo accepts at most 100 coordinates per request. */
const MAX_POSITIONS_PER_REQUEST = 100;

const DEFAULT_TIMEOUT_MS = 10_000;

const responseSchema = z.object({ elevation: z.array(z.number()) });

export interface OpenMeteoElevationProviderOptions {
  /** Elevation endpoint, e.g. `https://api.open-meteo.com/v1/elevation`. */
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
}

/** Elevations from the Open-Meteo API (Copernicus DEM, ~90 m resolution). */
export class OpenMeteoElevationProvider implements ElevationProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetch: typeof fetch;

  constructor({ baseUrl, timeoutMs, fetch: fetchImpl }: OpenMeteoElevationProviderOptions) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetch = fetchImpl ?? fetch;
  }

  async elevationsAt(positions: readonly Position[]): Promise<number[]> {
    const elevations: number[] = [];

    // Sequential on purpose: the free API is rate limited.
    for (let start = 0; start < positions.length; start += MAX_POSITIONS_PER_REQUEST) {
      const batch = positions.slice(start, start + MAX_POSITIONS_PER_REQUEST);
      elevations.push(...(await this.fetchBatch(batch)));
    }

    return elevations;
  }

  private async fetchBatch(batch: readonly Position[]): Promise<number[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('latitude', batch.map((position) => position.latitude).join(','));
    url.searchParams.set('longitude', batch.map((position) => position.longitude).join(','));

    try {
      const response = await this.fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!response.ok) {
        throw new Error(`Open-Meteo answered HTTP ${String(response.status)}`);
      }

      const { elevation } = responseSchema.parse(await response.json());
      if (elevation.length !== batch.length) {
        throw new Error(
          `Open-Meteo returned ${String(elevation.length)} elevations for ${String(batch.length)} positions`,
        );
      }

      return elevation;
    } catch (error) {
      throw new ElevationUnavailableError('Terrain elevations are temporarily unavailable.', {
        cause: error,
      });
    }
  }
}
