import { doublePrecision, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Frozen copies of proposals, each belonging to one signed-in Visitor (ADR 0009). */
export const savedItineraries = pgTable(
  'saved_itineraries',
  {
    id: uuid().primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    name: text().notNull(),
    kind: text().notNull(),
    length: doublePrecision().notNull(),
    proposal: jsonb().notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('saved_itineraries_owner_idx').on(table.ownerId, table.savedAt)],
);
