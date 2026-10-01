import { z } from 'zod';

import { activities } from '../domain/activity.ts';
import { categories } from '../domain/category.ts';
import { surfaces } from '../domain/surface.ts';

const metres = (description: string) =>
  z.number().meta({ description: `${description}, in metres.` });

const gradient = (description: string) =>
  z.number().meta({ description: `${description}, as a ratio (0.08 = 8 %).`, example: 0.072 });

const surfaceSchema = z.enum(surfaces).meta({ id: 'Surface' });

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
    activities: z.array(z.enum(activities).meta({ id: 'Activity' })),
    start: ascentPointSchema,
    top: ascentPointSchema,
    length: metres('Length along the path'),
    elevationGain: metres('Top elevation minus Start elevation'),
    averageGradient: gradient('Average Gradient'),
    maximumGradient: gradient('Steepest Gradient over at least 100 m'),
    difficultyScore: z
      .number()
      .meta({ description: 'Length in metres × average Gradient in percent.' }),
    category: z.enum(categories).meta({ id: 'Category' }),
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

export type AscentSummaryResponse = z.infer<typeof ascentSummarySchema>;

export type AscentResponse = z.infer<typeof ascentSchema>;
