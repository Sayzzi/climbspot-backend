import {
  firstPoint,
  lastPoint,
  type ProfilePoint,
} from '../../../shared/domain/survey/elevation-profile.ts';
import { round, roundCoordinate } from '../../../shared/http/rounding.ts';
import type { LoopItinerary, UphillItinerary } from '../domain/itinerary.ts';
import type { LoopItineraryResponse, UphillItineraryResponse } from './itinerary.schemas.ts';

const point = ({ position, elevation }: ProfilePoint) => ({
  latitude: roundCoordinate(position.latitude),
  longitude: roundCoordinate(position.longitude),
  elevation: round(elevation, 1),
});

/** Fields every kind of Itinerary shares. */
function common(itinerary: UphillItinerary | LoopItinerary) {
  return {
    exact: itinerary.exact,
    differences: itinerary.differences.map((difference) =>
      difference.kind === 'gradient'
        ? { ...difference, actual: round(difference.actual, 4) }
        : difference,
    ),
    path: {
      type: 'LineString' as const,
      coordinates: itinerary.path.map((position): [number, number] => [
        roundCoordinate(position.longitude),
        roundCoordinate(position.latitude),
      ]),
    },
    elevationProfile: itinerary.profile.map(({ distance, elevation }) => ({
      distance: round(distance, 1),
      elevation: round(elevation, 1),
    })),
    length: round(itinerary.measurements.length, 1),
    heightGained: round(itinerary.heightGained, 1),
  };
}

export function toLoopItineraryResponse(itinerary: LoopItinerary): LoopItineraryResponse {
  return { kind: 'loop', ...common(itinerary), relief: itinerary.relief };
}

export function toUphillItineraryResponse(itinerary: UphillItinerary): UphillItineraryResponse {
  const { measurements } = itinerary;
  return {
    kind: 'uphill',
    ...common(itinerary),
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
