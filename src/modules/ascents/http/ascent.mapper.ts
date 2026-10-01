import { activitiesFor } from '../domain/activity.ts';
import { startOf, topOf, type Ascent } from '../domain/ascent.ts';
import type { ProfilePoint } from '../domain/elevation-profile.ts';
import type { AscentResponse, AscentSummaryResponse } from './ascent.schemas.ts';

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** ~1 cm precision. */
const coordinate = (value: number) => round(value, 7);

const point = ({ position, elevation }: ProfilePoint) => ({
  latitude: coordinate(position.latitude),
  longitude: coordinate(position.longitude),
  elevation: round(elevation, 1),
});

export function toAscentSummaryResponse(ascent: Ascent): AscentSummaryResponse {
  const { measurements } = ascent;

  return {
    id: ascent.id,
    name: ascent.name,
    surface: ascent.surface,
    activities: [...activitiesFor(ascent.surface)],
    start: point(startOf(ascent)),
    top: point(topOf(ascent)),
    length: round(measurements.length, 1),
    elevationGain: round(measurements.elevationGain, 1),
    averageGradient: round(measurements.averageGradient, 4),
    maximumGradient: round(measurements.maximumGradient, 4),
    difficultyScore: Math.round(measurements.difficultyScore),
    category: measurements.category,
    createdAt: ascent.createdAt.toISOString(),
  };
}

export function toAscentResponse(ascent: Ascent): AscentResponse {
  return {
    ...toAscentSummaryResponse(ascent),
    path: {
      type: 'LineString',
      coordinates: ascent.profile.map(({ position }) => [
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
