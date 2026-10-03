import { doublePrecision, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** One row per signed-in Visitor, keyed by their Supabase user id (ADR 0009). */
export const accounts = pgTable('accounts', {
  visitorId: uuid('visitor_id').primaryKey(),
  displayName: text('display_name').notNull(),
  email: text(),
  /** Seconds per kilometre. */
  flatPace: doublePrecision('flat_pace'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
