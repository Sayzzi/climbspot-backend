import type { Position } from '../../../shared/domain/position.ts';
import {
  distanceBetween,
  interpolate,
  lengthOf,
  METRES_PER_DEGREE_OF_LATITUDE,
} from '../../../shared/domain/survey/geodesy.ts';
import type { Bounds, CatalogueAscent } from './ascent-catalogue.ts';
import type { RecordedRun, TrackPoint } from './recorded-run.ts';
import { ASCENT_CHECKPOINTS, ASCENT_TIME_RADIUS } from './strava-rules.ts';

/** How long a Visitor took from the Start to the Top of an Ascent in a Recorded Run (see CONTEXT.md). */
export interface AscentTime {
  readonly visitorId: string;
  readonly ascentId: string;
  /** The Recorded Run it was found in. */
  readonly stravaId: number;
  /** When the Visitor left the Start. */
  readonly startedAt: Date;
  readonly seconds: number;
}

/** A Visitor's best Ascent Time on one Ascent, and how many they have there. */
export interface AscentTimeSummary {
  readonly best: number;
  readonly count: number;
}

interface Pass {
  readonly point: TrackPoint;
  /** Metres from where the run had to come. */
  readonly distance: number;
}

/**
 * Every time a Recorded Run went up an Ascent: it came within {@link ASCENT_TIME_RADIUS}
 * metres of the Start, then of each checkpoint along the path in order, then of the
 * Top. The time runs between its closest passes at Start and Top. A run that only
 * crosses the Ascent, cuts a corner, or goes down it makes none.
 */
export function ascentTimesOn(run: RecordedRun, ascent: CatalogueAscent): AscentTime[] {
  const start = ascent.path[0];
  const top = ascent.path.at(-1);
  if (!start || !top) {
    return [];
  }
  const checkpoints = ASCENT_CHECKPOINTS.map((fraction) => along(ascent.path, fraction));
  const times: AscentTime[] = [];
  let atStart: Pass | undefined;
  let wasAtStart = false;
  let reached = 0;
  let atTop: Pass | undefined;

  const record = (from: Pass, to: Pass) => {
    times.push({
      visitorId: run.visitorId,
      ascentId: ascent.id,
      stravaId: run.stravaId,
      startedAt: new Date(run.startedAt.getTime() + from.point.elapsed * 1000),
      seconds: Math.round(to.point.elapsed - from.point.elapsed),
    });
  };

  for (const point of run.track) {
    if (atStart && atTop) {
      const fromTop = distanceBetween(point, top);
      if (fromTop <= ASCENT_TIME_RADIUS) {
        if (fromTop < atTop.distance) {
          atTop = { point, distance: fromTop };
        }
        continue;
      }
      record(atStart, atTop);
      [atStart, atTop, reached] = [undefined, undefined, 0];
    }

    const fromStart = distanceBetween(point, start);
    const isAtStart = fromStart <= ASCENT_TIME_RADIUS;
    if (isAtStart) {
      // A new visit to the Start begins a new attempt; within one, the closest pass counts.
      if (!wasAtStart || reached > 0 || !atStart || fromStart < atStart.distance) {
        atStart = { point, distance: fromStart };
        reached = 0;
      }
      wasAtStart = true;
      continue;
    }
    wasAtStart = false;
    if (!atStart) {
      continue;
    }
    while (reached < checkpoints.length && near(point, checkpoints[reached])) {
      reached += 1;
    }
    const fromTop = distanceBetween(point, top);
    if (reached === checkpoints.length && fromTop <= ASCENT_TIME_RADIUS) {
      atTop = { point, distance: fromTop };
    }
  }
  if (atStart && atTop) {
    record(atStart, atTop);
  }
  return times;
}

/** The box around a track, widened by {@link ASCENT_TIME_RADIUS} metres on every side. */
export function boundsOf(track: readonly Position[]): Bounds | undefined {
  if (track.length === 0) {
    return undefined;
  }
  const latitudes = track.map((point) => point.latitude);
  const longitudes = track.map((point) => point.longitude);
  const latitudeMargin = ASCENT_TIME_RADIUS / METRES_PER_DEGREE_OF_LATITUDE;
  const middle = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const longitudeMargin = latitudeMargin / Math.cos((middle * Math.PI) / 180);
  return {
    south: Math.min(...latitudes) - latitudeMargin,
    west: Math.min(...longitudes) - longitudeMargin,
    north: Math.max(...latitudes) + latitudeMargin,
    east: Math.max(...longitudes) + longitudeMargin,
  };
}

const near = (point: Position, checkpoint: Position | undefined) =>
  checkpoint !== undefined && distanceBetween(point, checkpoint) <= ASCENT_TIME_RADIUS;

/** The position at `fraction` of a path's length. */
function along(path: readonly Position[], fraction: number): Position | undefined {
  let left = lengthOf(path) * fraction;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (!from || !to) {
      continue;
    }
    const length = distanceBetween(from, to);
    if (left <= length) {
      return interpolate(from, to, length === 0 ? 0 : left / length);
    }
    left -= length;
  }
  return path.at(-1);
}
