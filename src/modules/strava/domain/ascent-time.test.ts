import { describe, expect, it } from 'vitest';

import { northOf, REFERENCE } from '../../../../test/terrain.ts';
import { ascentTimesOn } from './ascent-time.ts';
import type { RecordedRun } from './recorded-run.ts';

/** A run due north from `from` metres to `to` metres of REFERENCE, a point every `step` m at 5:00/km. */
function runNorth(from: number, to: number, step = 5): RecordedRun {
  const distances = Array.from(
    { length: (to - from) / step + 1 },
    (_, index) => from + index * step,
  );
  return {
    visitorId: 'visitor',
    stravaId: 1,
    startedAt: new Date('2026-10-01T07:00:00Z'),
    distance: to - from,
    movingTime: (to - from) * 0.3,
    track: northOf(REFERENCE, ...distances).map((position, index) => {
      const distance = index * step;
      return {
        ...position,
        altitude: 200,
        distance,
        elapsed: distance * 0.3,
        moving: distance * 0.3,
      };
    }),
  };
}

describe('Ascent Times on a short Ascent', () => {
  it('are found though its checkpoints lie near its Start', () => {
    const ascent = { id: 'short', path: northOf(REFERENCE, 0, 100) };

    const times = ascentTimesOn(runNorth(-50, 150), ascent);

    expect(times.map((time) => time.seconds)).toEqual([30]);
  });

  it('run from Start to Top even when both lie within the usual radius', () => {
    const ascent = { id: 'tiny', path: northOf(REFERENCE, 0, 20) };

    const times = ascentTimesOn(runNorth(-40, 60, 2), ascent);

    expect(times.map((time) => time.seconds)).toEqual([6]);
  });
});
