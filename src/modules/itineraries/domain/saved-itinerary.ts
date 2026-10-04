import { DomainError } from '../../../shared/domain/domain-error.ts';

export const PROPOSAL_KINDS = ['loop', 'uphill', 'session'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

/** A frozen copy of a proposal a signed-in Visitor keeps (see CONTEXT.md). */
export interface SavedItinerary {
  readonly id: string;
  /** The signed-in Visitor it belongs to. */
  readonly ownerId: string;
  readonly name: string;
  readonly kind: ProposalKind;
  /** Metres, the whole session's for a Hill Session. */
  readonly length: number;
  /** The proposal as the API gave it, kept as is. */
  readonly proposal: unknown;
  readonly savedAt: Date;
}

/** Names of Saved Itineraries are at most this long. */
export const SAVED_ITINERARY_NAME_MAX_LENGTH = 100;

/** A proposal kept takes at most this many characters once written out. */
export const SAVED_PROPOSAL_MAX_SIZE = 400_000;

export class SavedItineraryNotFoundError extends DomainError {
  readonly code = 'SAVED_ITINERARY_NOT_FOUND';
  readonly kind = 'not_found';

  constructor() {
    super('No such Saved Itinerary.');
  }
}

export class SavedItineraryTooLargeError extends DomainError {
  readonly code = 'SAVED_ITINERARY_TOO_LARGE';
  readonly kind = 'too_large';

  constructor() {
    super('This proposal is too large to keep.');
  }
}
