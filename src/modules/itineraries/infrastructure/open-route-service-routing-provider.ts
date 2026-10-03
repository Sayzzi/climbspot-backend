import { z } from 'zod';

import type { Activity } from '../../../shared/domain/activity.ts';
import type { Position } from '../../../shared/domain/position.ts';
import {
  RoutingUnavailableError,
  type RoutedPath,
  type RoutingProvider,
} from '../domain/routing-provider.ts';

/** OpenRouteService profile used for each Activity. */
const profiles: Record<Activity, string> = {
  running: 'foot-walking',
  trail_running: 'foot-hiking',
  road_cycling: 'cycling-road',
  gravel_cycling: 'cycling-regular',
  mountain_biking: 'cycling-mountain',
};

const DEFAULT_BASE_URL = 'https://api.openrouteservice.org';
const DEFAULT_TIMEOUT_MS = 15_000;
/**
 * How far from a way, in metres, a position may be and still be snapped onto it. The
 * ends stay close to where the Visitor placed them; waypoints in between only steer.
 */
const END_SNAP_RADIUS = 300;
const WAYPOINT_SNAP_RADIUS = 2_000;
/** Points a round trip goes through: more points, rounder loops. */
const ROUND_TRIP_POINTS = 4;

const RATE_LIMIT_ATTEMPTS = 3;
const FIRST_RETRY_DELAY_MS = 1_000;

const responseSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number(), z.number()])) }),
      }),
    )
    .min(1),
});

/** Rate limited for the minute: worth retrying after a wait. */
class RateLimitedError extends Error {}

export interface OpenRouteServiceRoutingProviderOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
  /** Waits between rate-limited attempts; replaced in tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Routing by the OpenRouteService API, elevations included. */
export class OpenRouteServiceRoutingProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetch: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: OpenRouteServiceRoutingProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetch = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  routeThrough(
    positions: readonly Position[],
    activity: Activity,
  ): Promise<RoutedPath | undefined> {
    return this.request(activity, {
      coordinates: positions.map(toCoordinates),
      radiuses: positions.map((_, index) =>
        index === 0 || index === positions.length - 1 ? END_SNAP_RADIUS : WAYPOINT_SNAP_RADIUS,
      ),
    });
  }

  routeTowards(
    start: Position,
    destination: Position,
    activity: Activity,
  ): Promise<RoutedPath | undefined> {
    return this.request(activity, {
      coordinates: [toCoordinates(start), toCoordinates(destination)],
      radiuses: [END_SNAP_RADIUS, WAYPOINT_SNAP_RADIUS],
    });
  }

  roundTrip(
    start: Position,
    length: number,
    activity: Activity,
    variant: number,
  ): Promise<RoutedPath | undefined> {
    return this.request(activity, {
      coordinates: [toCoordinates(start)],
      options: {
        round_trip: { length: Math.round(length), points: ROUND_TRIP_POINTS, seed: variant },
      },
    });
  }

  private async request(activity: Activity, body: object): Promise<RoutedPath | undefined> {
    let delay = FIRST_RETRY_DELAY_MS;

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.send(activity, body);
      } catch (error) {
        if (!(error instanceof RateLimitedError) || attempt === RATE_LIMIT_ATTEMPTS) {
          throw new RoutingUnavailableError('Routing is temporarily unavailable.', {
            cause: error,
          });
        }
        await this.sleep(delay);
        delay *= 2;
      }
    }
  }

  /** One request; any failure is thrown as is and wrapped by `request`. */
  private async send(activity: Activity, body: object): Promise<RoutedPath | undefined> {
    const response = await this.fetch(
      `${this.baseUrl}/v2/directions/${profiles[activity]}/geojson`,
      {
        method: 'POST',
        headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, elevation: true }),
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );

    if (response.status === 429) {
      // A spent daily quota will not come back by waiting.
      if (response.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('OpenRouteService daily quota is spent');
      }
      throw new RateLimitedError('OpenRouteService answered HTTP 429');
    }
    // No routable way near the positions: an answer, not a failure.
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`OpenRouteService answered HTTP ${String(response.status)}`);
    }

    const [feature] = responseSchema.parse(await response.json()).features;
    if (feature === undefined) {
      throw new Error('OpenRouteService answered no route');
    }
    return {
      points: feature.geometry.coordinates.map(([longitude, latitude, elevation]) => ({
        position: { latitude, longitude },
        elevation,
      })),
    };
  }
}

const toCoordinates = ({ latitude, longitude }: Position): [number, number] => [
  longitude,
  latitude,
];
