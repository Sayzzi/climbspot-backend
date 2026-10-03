import {
  SAVED_PROPOSAL_MAX_SIZE,
  SavedItineraryNotFoundError,
  SavedItineraryTooLargeError,
  type ProposalKind,
  type SavedItinerary,
} from '../domain/saved-itinerary.ts';
import type { SavedItineraryRepository } from '../domain/saved-itinerary-repository.ts';

export interface NewSavedItinerary {
  readonly name: string;
  readonly kind: ProposalKind;
  readonly length: number;
  readonly proposal: unknown;
}

export interface SavedItinerariesDependencies {
  readonly repository: SavedItineraryRepository;
  readonly newId: () => string;
  readonly now: () => Date;
}

/** A signed-in Visitor's Saved Itineraries: theirs only, never anyone else's. */
export class SavedItineraries {
  constructor(private readonly dependencies: SavedItinerariesDependencies) {}

  /** @throws {SavedItineraryTooLargeError} when the proposal is too large to keep. */
  async save(ownerId: string, saved: NewSavedItinerary): Promise<SavedItinerary> {
    if (JSON.stringify(saved.proposal).length > SAVED_PROPOSAL_MAX_SIZE) {
      throw new SavedItineraryTooLargeError();
    }
    const itinerary: SavedItinerary = {
      id: this.dependencies.newId(),
      ownerId,
      ...saved,
      savedAt: this.dependencies.now(),
    };
    await this.dependencies.repository.save(itinerary);
    return itinerary;
  }

  list(ownerId: string): Promise<SavedItinerary[]> {
    return this.dependencies.repository.listOf(ownerId);
  }

  /** @throws {SavedItineraryNotFoundError} when the owner has no such Saved Itinerary. */
  async get(id: string, ownerId: string): Promise<SavedItinerary> {
    const itinerary = await this.dependencies.repository.find(id, ownerId);
    if (!itinerary) {
      throw new SavedItineraryNotFoundError();
    }
    return itinerary;
  }

  /** @throws {SavedItineraryNotFoundError} when the owner has no such Saved Itinerary. */
  async rename(id: string, ownerId: string, name: string): Promise<SavedItinerary> {
    const renamed = { ...(await this.get(id, ownerId)), name };
    await this.dependencies.repository.save(renamed);
    return renamed;
  }

  /** @throws {SavedItineraryNotFoundError} when the owner has no such Saved Itinerary. */
  async delete(id: string, ownerId: string): Promise<void> {
    if (!(await this.dependencies.repository.delete(id, ownerId))) {
      throw new SavedItineraryNotFoundError();
    }
  }
}
