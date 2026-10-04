import {
  bigint,
  integer,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import type { TrackPoint } from '../../domain/recorded-run.ts';

/** One row per Strava Connection; tokens are kept encrypted (see TokenVault). */
export const stravaConnections = pgTable('strava_connections', {
  visitorId: uuid('visitor_id').primaryKey(),
  athleteId: bigint('athlete_id', { mode: 'number' }).notNull(),
  athleteName: text('athlete_name').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lostAt: timestamp('lost_at', { withTimezone: true }),
  /** Seconds per kilometre. */
  flatPace: doublePrecision('flat_pace'),
});

/** Recorded Runs, each Visitor's own, keyed by their Strava id. */
export const recordedRuns = pgTable(
  'recorded_runs',
  {
    visitorId: uuid('visitor_id').notNull(),
    stravaId: bigint('strava_id', { mode: 'number' }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    distance: doublePrecision().notNull(),
    movingTime: doublePrecision('moving_time').notNull(),
    track: jsonb().$type<readonly TrackPoint[]>().notNull(),
    /** The box around the track, widened by the Ascent Time radius; none without a track. */
    south: doublePrecision(),
    west: doublePrecision(),
    north: doublePrecision(),
    east: doublePrecision(),
  },
  (table) => [
    primaryKey({ columns: [table.visitorId, table.stravaId] }),
    index('recorded_runs_visitor_idx').on(table.visitorId, table.startedAt),
  ],
);

/** Ascent Times, each Visitor's own. */
export const ascentTimes = pgTable(
  'ascent_times',
  {
    visitorId: uuid('visitor_id').notNull(),
    ascentId: uuid('ascent_id').notNull(),
    stravaId: bigint('strava_id', { mode: 'number' }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    seconds: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.visitorId, table.ascentId, table.stravaId, table.startedAt] }),
  ],
);
