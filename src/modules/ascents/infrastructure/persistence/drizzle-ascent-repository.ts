import { eq, sql } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { AscentRepository } from '../../domain/ascent-repository.ts';
import { startOf, topOf, type Ascent } from '../../domain/ascent.ts';
import { buildProfile } from '../../domain/elevation-profile.ts';
import type { Position } from '../../domain/position.ts';
import { ascents } from './ascents.schema.ts';

const toWkt = ({ longitude, latitude }: Position) => `${String(longitude)} ${String(latitude)}`;

const geographyFromWkt = (wkt: string) => sql`extensions.st_geogfromtext(${`SRID=4326;${wkt}`})`;

const columns = {
  id: ascents.id,
  name: ascents.name,
  surface: ascents.surface,
  path: sql<string>`extensions.st_asgeojson(${ascents.path}, 15)`.as('path'),
  elevations: ascents.elevations,
  length: ascents.length,
  elevationGain: ascents.elevationGain,
  averageGradient: ascents.averageGradient,
  maximumGradient: ascents.maximumGradient,
  difficultyScore: ascents.difficultyScore,
  category: ascents.category,
  createdAt: ascents.createdAt,
};

type AscentRow = {
  [K in keyof typeof columns]: K extends 'path'
    ? string
    : (typeof ascents.$inferSelect)[K & keyof typeof ascents.$inferSelect];
};

export class DrizzleAscentRepository implements AscentRepository {
  constructor(private readonly db: Database) {}

  async save(ascent: Ascent): Promise<void> {
    const positions = ascent.profile.map((point) => point.position);

    await this.db.insert(ascents).values({
      id: ascent.id,
      name: ascent.name,
      surface: ascent.surface,
      path: geographyFromWkt(`LINESTRING(${positions.map(toWkt).join(', ')})`),
      elevations: ascent.profile.map((point) => point.elevation),
      start: geographyFromWkt(`POINT(${toWkt(startOf(ascent).position)})`),
      top: geographyFromWkt(`POINT(${toWkt(topOf(ascent).position)})`),
      ...ascent.measurements,
      createdAt: ascent.createdAt,
    });
  }

  async findById(id: string): Promise<Ascent | undefined> {
    const [row] = await this.db.select(columns).from(ascents).where(eq(ascents.id, id));
    return row && toAscent(row);
  }
}

function toAscent({
  id,
  name,
  surface,
  path,
  elevations,
  createdAt,
  ...measurements
}: AscentRow): Ascent {
  const { coordinates } = JSON.parse(path) as { coordinates: [number, number][] };
  const positions = coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));

  return {
    id,
    name,
    surface,
    profile: buildProfile(positions, elevations),
    measurements,
    createdAt,
  };
}
