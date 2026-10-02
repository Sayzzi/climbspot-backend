import { z } from 'zod';

import { ElevationUnavailableError, type ElevationProvider } from '../domain/elevation-provider.ts';
import type { Position } from '../../../shared/domain/position.ts';

/** Open-Meteo accepts at most 100 coordinates per request. */
const MAX_POSITIONS_PER_REQUEST = 100;

const DEFAULT_TIMEOUT_MS = 10_000;

/** Attempts per batch when the API answers 429 (rate limited), and the first wait. */
const RATE_LIMIT_ATTEMPTS = 3;
const FIRST_RETRY_DELAY_MS = 1_000;
/** Never wait longer than this for a `Retry-After`, so uploads stay responsive. */
const MAX_RETRY_DELAY_MS = 5_000;

class RateLimitedError extends Error {
  constructor(readonly retryAfterMs: number | undefined) {
    super('Open-Meteo answered HTTP 429');
  }
}

const responseSchema = z.object({ elevation: z.array(z.number()) });

export interface OpenMeteoElevationProviderOptions {
  /** Elevation endpoint, e.g. `https://api.open-meteo.com/v1/elevation`. */
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
  /** Waits between rate-limited attempts; replaced in tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Elevations from the Open-Meteo API (Copernicus DEM, ~90 m resolution). */
export class OpenMeteoElevationProvider implements ElevationProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetch: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor({ baseUrl, timeoutMs, fetch: fetchImpl, sleep }: OpenMeteoElevationProviderOptions) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetch = fetchImpl ?? fetch;
    this.sleep = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
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
    let delay = FIRST_RETRY_DELAY_MS;

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.requestBatch(batch);
      } catch (error) {
        if (!(error instanceof RateLimitedError) || attempt === RATE_LIMIT_ATTEMPTS) {
          throw new ElevationUnavailableError('Terrain elevations are temporarily unavailable.', {
            cause: error,
          });
        }
        await this.sleep(Math.min(error.retryAfterMs ?? delay, MAX_RETRY_DELAY_MS));
        delay *= 2;
      }
    }
  }

  /** One request; any failure is thrown as is and wrapped by `fetchBatch`. */
  private async requestBatch(batch: readonly Position[]): Promise<number[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('latitude', batch.map((position) => position.latitude).join(','));
    url.searchParams.set('longitude', batch.map((position) => position.longitude).join(','));

    const response = await this.fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      throw new RateLimitedError(retryAfter > 0 ? retryAfter * 1000 : undefined);
    }
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
  }
}
