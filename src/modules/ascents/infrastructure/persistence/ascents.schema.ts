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

import { categories } from '../../domain/category.ts';
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
    /** Resampled path, from Start to Top. */
    path: geography('LineString')('path').notNull(),
    /** Smoothed elevations in metres, one per point of `path`. */
    elevations: doublePrecision().array().notNull(),
    start: geography('Point')('start').notNull(),
    top: geography('Point')('top').notNull(),
    length: doublePrecision().notNull(),
    elevationGain: doublePrecision('elevation_gain').notNull(),
    averageGradient: doublePrecision('average_gradient').notNull(),
    maximumGradient: doublePrecision('maximum_gradient').notNull(),
    difficultyScore: doublePrecision('difficulty_score').notNull(),
    category: ascentCategory().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('ascents_start_idx').using('gist', table.start)],
);
