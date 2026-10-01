import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type {
  AscentRepository,
  NearbyAscent,
  NearbyCriteria,
} from '../../domain/ascent-repository.ts';
import { startOf, topOf, type Ascent, type AscentPoint } from '../../domain/ascent.ts';
import { buildProfile } from '../../domain/elevation-profile.ts';
import type { Position } from '../../domain/position.ts';
import { ascents } from './ascents.schema.ts';

const toWkt = ({ longitude, latitude }: Position) => `${String(longitude)} ${String(latitude)}`;

const geographyFromWkt = (wkt: string) => sql`extensions.st_geogfromtext(${`SRID=4326;${wkt}`})`;

const pointFrom = ({ longitude, latitude }: Position) =>
  sql`extensions.st_setsrid(extensions.st_makepoint(${longitude}, ${latitude}), 4326)::extensions.geography`;

const measurementColumns = {
  length: ascents.length,
  elevationGain: ascents.elevationGain,
  averageGradient: ascents.averageGradient,
  maximumGradient: ascents.maximumGradient,
  difficultyScore: ascents.difficultyScore,
  category: ascents.category,
};

const summaryColumns = {
  id: ascents.id,
  name: ascents.name,
  surface: ascents.surface,
  start: sql<string>`extensions.st_asgeojson(${ascents.start}, 15)`.as('start'),
  top: sql<string>`extensions.st_asgeojson(${ascents.top}, 15)`.as('top'),
  startElevation: sql<number>`${ascents.elevations}[1]`.as('start_elevation'),
  topElevation: sql<number>`${ascents.elevations}[array_length(${ascents.elevations}, 1)]`.as(
    'top_elevation',
  ),
  ...measurementColumns,
  createdAt: ascents.createdAt,
};

const ascentColumns = {
  id: ascents.id,
  name: ascents.name,
  surface: ascents.surface,
  path: sql<string>`extensions.st_asgeojson(${ascents.path}, 15)`.as('path'),
  elevations: ascents.elevations,
  ...measurementColumns,
  createdAt: ascents.createdAt,
};

type AscentRow = {
  [K in keyof typeof ascentColumns]: K extends 'path'
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
    const [row] = await this.db.select(ascentColumns).from(ascents).where(eq(ascents.id, id));
    return row && toAscent(row);
  }

  async findNearby({
    position,
    radius,
    limit,
    surfaces,
    categories,
  }: NearbyCriteria): Promise<NearbyAscent[]> {
    const searchedPosition = pointFrom(position);
    const distanceToStart = sql<number>`extensions.st_distance(${ascents.start}, ${searchedPosition})`;

    const rows = await this.db
      .select({ ...summaryColumns, distanceToStart: distanceToStart.as('distance_to_start') })
      .from(ascents)
      .where(
        and(
          sql`extensions.st_dwithin(${ascents.start}, ${searchedPosition}, ${radius})`,
          surfaces && inArray(ascents.surface, [...surfaces]),
          categories && inArray(ascents.category, [...categories]),
        ),
      )
      .orderBy(distanceToStart, ascents.id)
      .limit(limit);

    return rows.map(
      ({
        id,
        name,
        surface,
        start,
        top,
        startElevation,
        topElevation,
        createdAt,
        distanceToStart,
        ...measurements
      }) => ({
        ascent: {
          id,
          name,
          surface,
          start: toAscentPoint(start, startElevation),
          top: toAscentPoint(top, topElevation),
          measurements,
          createdAt,
        },
        distanceToStart,
      }),
    );
  }
}

function toAscentPoint(geoJson: string, elevation: number): AscentPoint {
  const {
    coordinates: [longitude, latitude],
  } = JSON.parse(geoJson) as { coordinates: [number, number] };
  return { position: { latitude, longitude }, elevation };
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
