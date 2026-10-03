import { isRunning } from '../../../shared/domain/activity.ts';
import { toEffortResponse } from '../../../shared/http/effort.ts';
import { activitiesFor } from '../domain/activity.ts';
import type { NearbyAscent } from '../domain/ascent-repository.ts';
import { summarize, type Ascent, type AscentPoint, type AscentSummary } from '../domain/ascent.ts';
import type {
  AscentResponse,
  AscentSummaryResponse,
  NearbyAscentsResponse,
} from './ascent.schemas.ts';

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** ~1 cm precision. */
const coordinate = (value: number) => round(value, 7);

const point = ({ position, elevation }: AscentPoint) => ({
  latitude: coordinate(position.latitude),
  longitude: coordinate(position.longitude),
  elevation: round(elevation, 1),
});

export function toAscentSummaryResponse(ascent: AscentSummary): AscentSummaryResponse {
  const { measurements } = ascent;
  const activities = activitiesFor(ascent.surface);

  return {
    id: ascent.id,
    name: ascent.name,
    surface: ascent.surface,
    activities: [...activities],
    start: point(ascent.start),
    top: point(ascent.top),
    length: round(measurements.length, 1),
    elevationGain: round(measurements.elevationGain, 1),
    heightGained: round(measurements.heightGained, 1),
    averageGradient: round(measurements.averageGradient, 4),
    maximumGradient: round(measurements.maximumGradient, 4),
    difficultyScore: measurements.difficultyScore,
    category: measurements.category,
    ...(activities.some(isRunning) && { effort: toEffortResponse(measurements) }),
    createdAt: ascent.createdAt.toISOString(),
  };
}

export function toAscentResponse(ascent: Ascent): AscentResponse {
  return {
    ...toAscentSummaryResponse(summarize(ascent)),
    path: {
      type: 'LineString',
      coordinates: ascent.path.map((position) => [
        coordinate(position.longitude),
        coordinate(position.latitude),
      ]),
    },
    elevationProfile: ascent.profile.map(({ distance, elevation }) => ({
      distance: round(distance, 1),
      elevation: round(elevation, 1),
    })),
  };
}

export function toNearbyAscentsResponse(results: readonly NearbyAscent[]): NearbyAscentsResponse {
  return {
    ascents: results.map(({ ascent, distanceToStart }) => ({
      ...toAscentSummaryResponse(ascent),
      distanceToStart: round(distanceToStart, 1),
    })),
  };
}
