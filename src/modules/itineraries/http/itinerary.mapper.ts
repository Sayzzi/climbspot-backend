import { round, roundCoordinate } from '../../../shared/http/rounding.ts';
import {
  firstPoint,
  lastPoint,
  type ProfilePoint,
} from '../../../shared/domain/survey/elevation-profile.ts';
import type { UphillItinerary } from '../domain/itinerary.ts';
import type { UphillItineraryResponse } from './itinerary.schemas.ts';

const point = ({ position, elevation }: ProfilePoint) => ({
  latitude: roundCoordinate(position.latitude),
  longitude: roundCoordinate(position.longitude),
  elevation: round(elevation, 1),
});

export function toUphillItineraryResponse(itinerary: UphillItinerary): UphillItineraryResponse {
  const { measurements } = itinerary;
  return {
    kind: 'uphill',
    exact: itinerary.exact,
    differences: itinerary.differences.map((difference) =>
      difference.kind === 'gradient'
        ? { ...difference, actual: round(difference.actual, 4) }
        : difference,
    ),
    path: {
      type: 'LineString',
      coordinates: itinerary.path.map((position) => [
        roundCoordinate(position.longitude),
        roundCoordinate(position.latitude),
      ]),
    },
    elevationProfile: itinerary.profile.map(({ distance, elevation }) => ({
      distance: round(distance, 1),
      elevation: round(elevation, 1),
    })),
    length: round(measurements.length, 1),
    heightGained: round(itinerary.heightGained, 1),
    start: point(firstPoint(itinerary.profile)),
    top: point(lastPoint(itinerary.profile)),
    elevationGain: round(measurements.elevationGain, 1),
    averageGradient: round(measurements.averageGradient, 4),
    maximumGradient: round(measurements.maximumGradient, 4),
    difficultyScore: measurements.difficultyScore,
    category: measurements.category,
    distanceToStart: round(itinerary.distanceToStart, 1),
  };
}
