import type { Position } from '../../../shared/domain/position.ts';
import { distanceBetween, interpolate, lengthOf } from '../../../shared/domain/survey/geodesy.ts';
import type { AscentPath } from '../../../shared/domain/ascent-times.ts';
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

interface Pass {
  readonly point: TrackPoint;
  /** Metres from where the run had to come. */
  readonly distance: number;
}

/**
 * Every time a Recorded Run went up an Ascent: it came within {@link ASCENT_TIME_RADIUS}
 * metres (less on a short Ascent) of the Start, then of each checkpoint along the path in order, then of the
 * Top. The time runs between its closest passes at Start and Top. A run that only
 * crosses the Ascent, cuts a corner, or goes down it makes none.
 */
export function ascentTimesOn(run: RecordedRun, ascent: AscentPath): AscentTime[] {
  const start = ascent.path[0];
  const top = ascent.path.at(-1);
  if (!start || !top) {
    return [];
  }
  const checkpoints = ASCENT_CHECKPOINTS.map((fraction) => along(ascent.path, fraction));
  const radius = Math.min(ASCENT_TIME_RADIUS, lengthOf(ascent.path) / 8);
  const near = (point: Position, checkpoint: Position | undefined) =>
    checkpoint !== undefined && distanceBetween(point, checkpoint) <= radius;
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
      if (fromTop <= radius) {
        if (fromTop < atTop.distance) {
          atTop = { point, distance: fromTop };
        }
        continue;
      }
      record(atStart, atTop);
      [atStart, atTop, reached] = [undefined, undefined, 0];
    }

    const fromStart = distanceBetween(point, start);
    const isAtStart = fromStart <= radius;
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
    if (reached === checkpoints.length && fromTop <= radius) {
      atTop = { point, distance: fromTop };
    }
  }
  if (atStart && atTop) {
    record(atStart, atTop);
  }
  return times;
}

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
