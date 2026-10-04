import { z } from 'zod';

import {
  PROPOSAL_KINDS,
  SAVED_ITINERARY_NAME_MAX_LENGTH,
  type ProposalKind,
  type SavedItinerary,
} from '../domain/saved-itinerary.ts';
import {
  hillSessionSchema,
  loopItinerarySchema,
  uphillItinerarySchema,
} from './itinerary.schemas.ts';

/** Any proposal of the Plan tab, as the Itineraries API gives it. */
export const proposalSchema = z.discriminatedUnion('kind', [
  loopItinerarySchema,
  uphillItinerarySchema,
  hillSessionSchema,
]);

type Proposal = z.infer<typeof proposalSchema>;

const nameSchema = z.string().trim().min(1).max(SAVED_ITINERARY_NAME_MAX_LENGTH);

export const newSavedItinerarySchema = z
  .object({ name: nameSchema, proposal: proposalSchema })
  .meta({ id: 'NewSavedItinerary' });

export const savedItineraryChangesSchema = z
  .object({ name: nameSchema })
  .meta({ id: 'SavedItineraryChanges' });

export const savedItinerarySummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    kind: z.enum(PROPOSAL_KINDS),
    length: z.number().meta({ description: 'Metres; the whole session for a Hill Session.' }),
    savedAt: z.iso.datetime(),
  })
  .meta({ id: 'SavedItinerarySummary' });

export const savedItinerarySchema = savedItinerarySummarySchema
  .extend({ proposal: proposalSchema })
  .meta({ id: 'SavedItinerary' });

export const savedItinerariesSchema = z
  .object({ savedItineraries: z.array(savedItinerarySummarySchema) })
  .meta({ id: 'SavedItineraries' });

/** Kind and length of a proposal, kept beside it for lists. */
export function summaryOf(proposal: Proposal): { kind: ProposalKind; length: number } {
  return {
    kind: proposal.kind,
    length: proposal.kind === 'session' ? proposal.totals.length : proposal.length,
  };
}

export function toSummaryResponse(
  saved: SavedItinerary,
): z.infer<typeof savedItinerarySummarySchema> {
  return {
    id: saved.id,
    name: saved.name,
    kind: saved.kind,
    length: saved.length,
    savedAt: saved.savedAt.toISOString(),
  };
}

export function toSavedItineraryResponse(saved: SavedItinerary) {
  return { ...toSummaryResponse(saved), proposal: saved.proposal };
}
