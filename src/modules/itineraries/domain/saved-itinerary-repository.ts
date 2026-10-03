import type { SavedItinerary } from './saved-itinerary.ts';

export interface SavedItineraryRepository {
  save(itinerary: SavedItinerary): Promise<void>;
  /** The owner's Saved Itineraries, newest first. */
  listOf(ownerId: string): Promise<SavedItinerary[]>;
  /** The Saved Itinerary, only if it belongs to the owner. */
  find(id: string, ownerId: string): Promise<SavedItinerary | undefined>;
  /** Removes it if it belongs to the owner; says whether it did. */
  delete(id: string, ownerId: string): Promise<boolean>;
  /** Removes all of an owner's Saved Itineraries. */
  deleteAllOf(ownerId: string): Promise<void>;
}
