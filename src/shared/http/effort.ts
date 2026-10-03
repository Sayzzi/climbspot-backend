import { z } from 'zod';

import { kmEffort } from '../domain/survey/effort.ts';
import type { Measurements } from '../domain/survey/measurements.ts';
import { round } from './rounding.ts';

/** How hard a path is to run (see CONTEXT.md), shared by Ascents and Itineraries. */
export const effortSchema = z
  .object({
    kmEffort: z.number().meta({
      description: 'Length in km plus one per 100 m of Height Gained, rounded to 0.1.',
      example: 4.8,
    }),
    flatEquivalentDistance: z.number().meta({
      description:
        'Distance on the flat costing a runner as much as the path (Minetti, descents at best 10 % faster), in metres.',
    }),
  })
  .meta({ id: 'Effort', description: 'How hard the path is to run; only given for running.' });

export function toEffortResponse({
  length,
  heightGained,
  flatEquivalentDistance,
}: Measurements): z.infer<typeof effortSchema> {
  return {
    kmEffort: round(kmEffort(length, heightGained), 1),
    flatEquivalentDistance: round(flatEquivalentDistance, 1),
  };
}
