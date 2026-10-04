import { bigint, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** One row per Strava Connection; tokens are kept encrypted (see TokenVault). */
export const stravaConnections = pgTable('strava_connections', {
  visitorId: uuid('visitor_id').primaryKey(),
  athleteId: bigint('athlete_id', { mode: 'number' }).notNull(),
  athleteName: text('athlete_name').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull(),
});
