import {
  firstPoint,
  lastPoint,
  type ProfilePoint,
} from '../../../shared/domain/survey/elevation-profile.ts';
import { isRunning, type Activity } from '../../../shared/domain/activity.ts';
import { toEffortResponse } from '../../../shared/http/effort.ts';
import { round, roundCoordinate } from '../../../shared/http/rounding.ts';
import type { Position } from '../../../shared/domain/position.ts';
import type { HillSession, LoopItinerary, UphillItinerary } from '../domain/itinerary.ts';
import type {
  HillSessionResponse,
  LoopItineraryResponse,
  UphillItineraryResponse,
} from './itinerary.schemas.ts';

const point = ({ position, elevation }: ProfilePoint) => ({
  latitude: roundCoordinate(position.latitude),
  longitude: roundCoordinate(position.longitude),
  elevation: round(elevation, 1),
});

/** Fields every kind of Itinerary shares; the running effort only for running Activities. */
function common(itinerary: UphillItinerary | LoopItinerary, activity: Activity) {
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
    heightGained: round(itinerary.measurements.heightGained, 1),
    ...(isRunning(activity) && { effort: toEffortResponse(itinerary.measurements) }),
  };
}

export function toLoopItineraryResponse(
  itinerary: LoopItinerary,
  activity: Activity,
): LoopItineraryResponse {
  return { kind: 'loop', ...common(itinerary, activity), relief: itinerary.relief };
}

export function toUphillItineraryResponse(
  itinerary: UphillItinerary,
  activity: Activity,
): UphillItineraryResponse {
  const { measurements } = itinerary;
  return {
    kind: 'uphill',
    ...common(itinerary, activity),
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

const lineString = (positions: readonly Position[]) => ({
  type: 'LineString' as const,
  coordinates: positions.map((position): [number, number] => [
    roundCoordinate(position.longitude),
    roundCoordinate(position.latitude),
  ]),
});

export function toHillSessionResponse(session: HillSession): HillSessionResponse {
  const { repeat, measurements } = session;
  return {
    kind: 'session',
    exact: session.exact,
    differences: session.differences.map((difference) =>
      difference.kind === 'gradient'
        ? { ...difference, actual: round(difference.actual, 4) }
        : difference,
    ),
    repeats: session.repeats,
    repeat: {
      path: lineString(repeat.path),
      elevationProfile: repeat.profile.map(({ distance, elevation }) => ({
        distance: round(distance, 1),
        elevation: round(elevation, 1),
      })),
      length: round(repeat.measurements.length, 1),
      averageGradient: round(repeat.measurements.averageGradient, 4),
      maximumGradient: round(repeat.measurements.maximumGradient, 4),
      start: point(firstPoint(repeat.profile)),
      top: point(lastPoint(repeat.profile)),
    },
    warmUp: {
      path: lineString(session.warmUp.path),
      length: round(session.warmUp.profile.at(-1)?.distance ?? 0, 1),
    },
    totals: {
      length: round(measurements.length, 1),
      heightGained: round(measurements.heightGained, 1),
      effort: toEffortResponse(measurements),
    },
  };
}
