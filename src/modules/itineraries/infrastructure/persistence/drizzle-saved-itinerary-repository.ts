import { and, desc, eq } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { ProposalKind, SavedItinerary } from '../../domain/saved-itinerary.ts';
import type { SavedItineraryRepository } from '../../domain/saved-itinerary-repository.ts';
import { savedItineraries } from './saved-itineraries.schema.ts';

type Row = typeof savedItineraries.$inferSelect;

const toSavedItinerary = (row: Row): SavedItinerary => ({
  ...row,
  kind: row.kind as ProposalKind,
});

export class DrizzleSavedItineraryRepository implements SavedItineraryRepository {
  constructor(private readonly db: Database) {}

  async save(itinerary: SavedItinerary): Promise<void> {
    await this.db
      .insert(savedItineraries)
      .values(itinerary)
      .onConflictDoUpdate({ target: savedItineraries.id, set: { name: itinerary.name } });
  }

  async listOf(ownerId: string): Promise<SavedItinerary[]> {
    const rows = await this.db
      .select()
      .from(savedItineraries)
      .where(eq(savedItineraries.ownerId, ownerId))
      .orderBy(desc(savedItineraries.savedAt));
    return rows.map(toSavedItinerary);
  }

  async find(id: string, ownerId: string): Promise<SavedItinerary | undefined> {
    const [row] = await this.db
      .select()
      .from(savedItineraries)
      .where(and(eq(savedItineraries.id, id), eq(savedItineraries.ownerId, ownerId)));
    return row && toSavedItinerary(row);
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(savedItineraries)
      .where(and(eq(savedItineraries.id, id), eq(savedItineraries.ownerId, ownerId)))
      .returning({ id: savedItineraries.id });
    return deleted.length > 0;
  }

  async deleteAllOf(ownerId: string): Promise<void> {
    await this.db.delete(savedItineraries).where(eq(savedItineraries.ownerId, ownerId));
  }
}
