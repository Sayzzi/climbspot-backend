import { z } from 'zod';

import {
  NEARBY_DEFAULT_LIMIT,
  NEARBY_DEFAULT_RADIUS,
  NEARBY_MAXIMUM_LIMIT,
  NEARBY_MAXIMUM_RADIUS,
} from '../application/find-ascents-nearby.ts';
import { activities } from '../../../shared/domain/activity.ts';
import { MAXIMUM_GRADIENT_STRETCH } from '../../../shared/domain/survey/survey-rules.ts';
import { categories } from '../../../shared/domain/survey/category.ts';
import { surfaces } from '../domain/surface.ts';

const metres = (description: string) =>
  z.number().meta({ description: `${description}, in metres.` });

const gradient = (description: string) =>
  z.number().meta({ description: `${description}, as a ratio (0.08 = 8 %).`, example: 0.072 });

const surfaceSchema = z.enum(surfaces).meta({ id: 'Surface' });

const activitySchema = z.enum(activities).meta({ id: 'Activity' });

const categorySchema = z.enum(categories).meta({ id: 'Category' });

export const ascentPointSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    elevation: metres('Elevation'),
  })
  .meta({ id: 'AscentPoint' });

export const ascentSummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    surface: surfaceSchema,
    activities: z.array(activitySchema),
    start: ascentPointSchema,
    top: ascentPointSchema,
    length: metres('Length along the path'),
    elevationGain: metres('Top elevation minus Start elevation'),
    averageGradient: gradient('Average Gradient'),
    maximumGradient: gradient(
      `Steepest Gradient over at least ${String(MAXIMUM_GRADIENT_STRETCH)} m`,
    ),
    difficultyScore: z
      .number()
      .meta({ description: 'Length in metres × average Gradient in percent.' }),
    category: categorySchema,
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'AscentSummary' });

export const ascentSchema = ascentSummarySchema
  .extend({
    path: z
      .object({
        type: z.literal('LineString'),
        coordinates: z.array(z.tuple([z.number(), z.number()])),
      })
      .meta({ description: 'GeoJSON LineString from Start to Top ([longitude, latitude] pairs).' }),
    elevationProfile: z.array(
      z.object({
        distance: metres('Distance from the Start along the path'),
        elevation: metres('Elevation'),
      }),
    ),
  })
  .meta({ id: 'Ascent' });

export const createAscentFieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  surface: surfaceSchema,
});

/** OpenAPI description of the multipart body; the file itself is read by multer. */
export const createAscentBodySchema = createAscentFieldsSchema.extend({
  gpx: z.string().meta({ format: 'binary', description: 'GPX file of the path (track or route).' }),
});

export const ascentIdParamsSchema = z.object({ id: z.uuid() });

/** Query of the nearby search, once normalised from strings (see the router). */
export const nearbyQuerySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z
    .number()
    .positive()
    .max(NEARBY_MAXIMUM_RADIUS)
    .default(NEARBY_DEFAULT_RADIUS)
    .meta({ description: 'Maximum distance to the Start, in metres.' }),
  limit: z.number().int().min(1).max(NEARBY_MAXIMUM_LIMIT).default(NEARBY_DEFAULT_LIMIT),
  activity: z.array(activitySchema).optional().meta({
    description: 'Only Ascents suitable for one of these Activities. Repeatable.',
  }),
  category: z.array(categorySchema).optional().meta({
    description: 'Only Ascents in one of these Categories. Repeatable.',
  }),
});

export const nearbyAscentsSchema = z
  .object({
    ascents: z.array(
      ascentSummarySchema.extend({
        distanceToStart: metres('Geodesic distance from the searched position to the Start'),
      }),
    ),
  })
  .meta({ id: 'NearbyAscents' });

export type NearbyAscentsResponse = z.infer<typeof nearbyAscentsSchema>;

export type AscentSummaryResponse = z.infer<typeof ascentSummarySchema>;

export type AscentResponse = z.infer<typeof ascentSchema>;
