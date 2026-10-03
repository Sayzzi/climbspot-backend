import {
  customType,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { categories } from '../../../../shared/domain/survey/category.ts';
import { surfaces } from '../../domain/surface.ts';

/**
 * PostGIS geography column in WGS 84. Values are written and read through SQL
 * functions (WKT in, GeoJSON out), so the driver value is never used directly.
 * The type is resolved from the `extensions` schema through the search path.
 */
const geography = (shape: 'Point' | 'LineString') =>
  customType<{ data: string; driverData: string }>({
    dataType: () => `geography(${shape}, 4326)`,
  });

export const ascentSurface = pgEnum('ascent_surface', surfaces);

export const ascentCategory = pgEnum('ascent_category', categories);

export const ascents = pgTable(
  'ascents',
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    surface: ascentSurface().notNull(),
    /** Shape shown on maps, from Start to Top, simplified from the uploaded path. */
    path: geography('LineString')('path').notNull(),
    /** Samples every SAMPLING_SPACING metres, from Start to Top: what was measured. */
    sampledPath: geography('LineString')('sampled_path').notNull(),
    /** Distance of each sample along the path, in metres. */
    sampleDistances: doublePrecision('sample_distances').array().notNull(),
    /** Smoothed elevations in metres, one per sample. */
    elevations: doublePrecision().array().notNull(),
    start: geography('Point')('start').notNull(),
    top: geography('Point')('top').notNull(),
    length: doublePrecision().notNull(),
    elevationGain: doublePrecision('elevation_gain').notNull(),
    heightGained: doublePrecision('height_gained').notNull(),
    averageGradient: doublePrecision('average_gradient').notNull(),
    maximumGradient: doublePrecision('maximum_gradient').notNull(),
    difficultyScore: doublePrecision('difficulty_score').notNull(),
    category: ascentCategory().notNull(),
    flatEquivalentDistance: doublePrecision('flat_equivalent_distance').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('ascents_start_idx').using('gist', table.start)],
);
