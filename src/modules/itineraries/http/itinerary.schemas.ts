import { z } from 'zod';

import { activities, runningActivities } from '../../../shared/domain/activity.ts';
import { effortSchema } from '../../../shared/http/effort.ts';
import { categories } from '../../../shared/domain/survey/category.ts';
import { reliefs } from '../domain/itinerary.ts';

const metres = (description: string) =>
  z.number().meta({ description: `${description}, in metres.` });

const gradient = (description: string) =>
  z.number().meta({ description: `${description}, as a ratio (0.08 = 8 %).` });

const positionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const activitySchema = z.enum(activities).meta({ id: 'Activity' });

const pointSchema = positionSchema
  .extend({ elevation: metres('Elevation') })
  .meta({ id: 'ItineraryPoint' });

const differenceSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('gradient'),
      min: z.number(),
      max: z.number(),
      actual: gradient('Average Gradient of the proposal'),
    }),
    z.object({
      kind: z.literal('relief'),
      wanted: z.enum(reliefs),
      actual: z.enum(reliefs),
    }),
  ])
  .meta({ id: 'ItineraryDifference' });

const lineStringSchema = z
  .object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
  })
  .meta({ description: 'GeoJSON LineString ([longitude, latitude] pairs).' });

const itineraryBase = {
  exact: z.boolean().meta({ description: 'True when the proposal matches the request.' }),
  differences: z.array(differenceSchema),
  path: lineStringSchema,
  elevationProfile: z.array(
    z.object({ distance: metres('Distance from the beginning'), elevation: metres('Elevation') }),
  ),
  length: metres('Length along the path'),
  heightGained: metres('Sum of every rise along the path'),
  effort: effortSchema.optional(),
};

export const loopItinerarySchema = z
  .object({
    kind: z.literal('loop'),
    ...itineraryBase,
    relief: z.enum(reliefs).meta({ id: 'Relief' }),
  })
  .meta({ id: 'LoopItinerary' });

export const loopRequestSchema = z
  .object({
    start: positionSchema,
    distance: z.number().min(1000).max(100_000).meta({
      description: 'Metres; Loops are never shorter and at most 20 % longer.',
    }),
    relief: z.enum(reliefs).meta({ id: 'Relief' }),
    activity: activitySchema,
  })
  .meta({ id: 'LoopRequest' });

export const loopItinerariesSchema = z
  .object({ itineraries: z.array(loopItinerarySchema) })
  .meta({ id: 'LoopItineraries' });

export type LoopItineraryResponse = z.infer<typeof loopItinerarySchema>;

export const uphillItinerarySchema = z
  .object({
    kind: z.literal('uphill'),
    ...itineraryBase,
    start: pointSchema,
    top: pointSchema,
    elevationGain: metres('Top elevation minus start elevation'),
    averageGradient: gradient('Average Gradient'),
    maximumGradient: gradient('Steepest Gradient over at least 100 m'),
    difficultyScore: z.number(),
    category: z.enum(categories).meta({ id: 'Category' }),
    distanceToStart: metres("Distance from the Visitor's point to the start"),
  })
  .meta({ id: 'UphillItinerary' });

export const uphillRequestSchema = z
  .object({
    start: positionSchema,
    radius: z.number().positive().max(25_000).default(10_000).meta({
      description: 'The Itinerary starts within this distance of `start`, in metres.',
    }),
    length: z.number().min(500).max(30_000).meta({
      description: 'Metres; proposals are never shorter and at most 20 % longer.',
    }),
    minGradient: gradient('Lowest average Gradient wanted').min(0).max(0.3),
    maxGradient: gradient('Highest average Gradient wanted').min(0).max(0.3),
    activity: activitySchema,
  })
  .refine((request) => request.minGradient <= request.maxGradient, {
    message: 'minGradient must not exceed maxGradient.',
    path: ['minGradient'],
  })
  .meta({ id: 'UphillRequest' });

export const uphillItinerariesSchema = z
  .object({ itineraries: z.array(uphillItinerarySchema) })
  .meta({ id: 'UphillItineraries' });

export type UphillItineraryResponse = z.infer<typeof uphillItinerarySchema>;

export const hillSessionRequestSchema = z
  .object({
    start: positionSchema,
    radius: z.number().positive().max(25_000).default(10_000).meta({
      description: 'The Repeats start within this distance of `start`, in metres.',
    }),
    repeats: z.number().int().min(2).max(20).meta({ description: 'Number of Repeats.' }),
    repeatLength: z.number().min(200).max(2000).meta({
      description: 'Metres; every Repeat is exactly this long.',
    }),
    minGradient: gradient('Lowest average Gradient of the Repeat').min(0).max(0.3),
    maxGradient: gradient('Highest average Gradient of the Repeat').min(0).max(0.3),
    activity: z.enum(runningActivities).meta({ description: 'A running Activity.' }),
  })
  .refine((request) => request.minGradient <= request.maxGradient, {
    message: 'minGradient must not exceed maxGradient.',
    path: ['minGradient'],
  })
  .meta({ id: 'HillSessionRequest' });

export const hillSessionSchema = z
  .object({
    kind: z.literal('session'),
    exact: itineraryBase.exact,
    differences: itineraryBase.differences,
    repeats: z.number().int(),
    repeat: z
      .object({
        path: lineStringSchema,
        elevationProfile: itineraryBase.elevationProfile,
        length: metres('Length of one Repeat'),
        averageGradient: gradient('Average Gradient of the Repeat'),
        maximumGradient: gradient('Steepest Gradient of the Repeat'),
        start: pointSchema,
        top: pointSchema,
      })
      .meta({ description: 'The Uphill Itinerary run up for each Repeat.' }),
    warmUp: z
      .object({
        path: lineStringSchema,
        elevationProfile: itineraryBase.elevationProfile,
        length: metres('Length of the Warm-up'),
      })
      .meta({
        description: 'From `start` to the foot of the Repeat; the Cool-down is the same way back.',
      }),
    totals: z
      .object({
        length: metres('Length of the whole session'),
        heightGained: metres('Every rise over the whole session'),
        effort: effortSchema,
      })
      .meta({ description: 'Warm-up, Repeats and Recoveries, and Cool-down together.' }),
  })
  .meta({ id: 'HillSession' });

export const hillSessionsSchema = z
  .object({ sessions: z.array(hillSessionSchema) })
  .meta({ id: 'HillSessions' });

export type HillSessionResponse = z.infer<typeof hillSessionSchema>;
