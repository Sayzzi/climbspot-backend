import type { Bounds, Position } from '../../../shared/domain/position.ts';
import { METRES_PER_DEGREE_OF_LATITUDE } from '../../../shared/domain/survey/geodesy.ts';
import {
  ASCENT_TIME_RADIUS,
  IMPORT_MONTHS,
  RECORDED_RUN_SPORTS,
  TRACK_SPACING,
} from './strava-rules.ts';

/** One reading of a Strava recording, as Strava gives it. */
export interface TrackSample {
  readonly latitude: number;
  readonly longitude: number;
  /** Recorded altitude in metres, when the device gave one. */
  readonly altitude: number | null;
  /** Metres from the start. */
  readonly distance: number;
  /** Seconds since the start. */
  readonly elapsed: number;
  /** Whether the runner was moving when this reading was taken. */
  readonly moving: boolean;
}

/** A point kept of a Recorded Run's track. */
export interface TrackPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude: number | null;
  readonly distance: number;
  /** Seconds since the start. */
  readonly elapsed: number;
  /** Seconds spent moving since the start: stops are left out. */
  readonly moving: number;
}

/** A running or trail-running outing imported through a Strava Connection (see CONTEXT.md). */
export interface RecordedRun {
  readonly visitorId: string;
  readonly stravaId: number;
  readonly startedAt: Date;
  /** Metres. */
  readonly distance: number;
  /** Seconds. */
  readonly movingTime: number;
  readonly track: readonly TrackPoint[];
}

export const isRecordedRunSport = (sport: string): boolean => RECORDED_RUN_SPORTS.includes(sport);

/** Where the first import starts: {@link IMPORT_MONTHS} months before `now`. */
export function firstImportStart(now: Date): Date {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - IMPORT_MONTHS);
  return start;
}

/**
 * The track kept of a recording: a point every {@link TRACK_SPACING} metres or so, and
 * the last one, each with the time spent moving so far.
 */
export function toTrack(samples: readonly TrackSample[]): TrackPoint[] {
  const track: TrackPoint[] = [];
  let moving = 0;
  samples.forEach((sample, index) => {
    const previous = samples[index - 1];
    if (previous && sample.moving) {
      moving += sample.elapsed - previous.elapsed;
    }
    const lastKept = track.at(-1);
    const isLast = index === samples.length - 1;
    if (!lastKept || isLast || sample.distance - lastKept.distance >= TRACK_SPACING) {
      const { moving: _wasMoving, ...reading } = sample;
      track.push({ ...reading, moving });
    }
  });
  return track;
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
