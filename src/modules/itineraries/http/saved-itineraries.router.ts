import { Router, type Request } from 'express';
import { z } from 'zod';

import { signedInVisitor } from '../../../shared/http/identity.ts';
import type { SavedItineraries } from '../application/saved-itineraries.ts';
import { SavedItineraryNotFoundError } from '../domain/saved-itinerary.ts';
import {
  describe,
  newSavedItinerarySchema,
  savedItineraryChangesSchema,
  toSavedItineraryResponse,
  toSummaryResponse,
} from './saved-itinerary.schemas.ts';

/** The Saved Itinerary's id; anything that is not one names none. */
function idOf(req: Request): string {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    throw new SavedItineraryNotFoundError();
  }
  return id.data;
}

export function createSavedItinerariesRouter(savedItineraries: SavedItineraries): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const { visitorId } = signedInVisitor(res);
    const { name, proposal } = newSavedItinerarySchema.parse(req.body);
    const saved = await savedItineraries.save(visitorId, {
      name,
      proposal,
      ...describe(proposal),
    });
    res.status(201).json(toSavedItineraryResponse(saved));
  });

  router.get('/', async (_req, res) => {
    const list = await savedItineraries.list(signedInVisitor(res).visitorId);
    res.json({ savedItineraries: list.map(toSummaryResponse) });
  });

  router.get('/:id', async (req, res) => {
    const saved = await savedItineraries.get(idOf(req), signedInVisitor(res).visitorId);
    res.json(toSavedItineraryResponse(saved));
  });

  router.patch('/:id', async (req, res) => {
    const { visitorId } = signedInVisitor(res);
    const { name } = savedItineraryChangesSchema.parse(req.body);
    res.json(toSavedItineraryResponse(await savedItineraries.rename(idOf(req), visitorId, name)));
  });

  router.delete('/:id', async (req, res) => {
    await savedItineraries.delete(idOf(req), signedInVisitor(res).visitorId);
    res.status(204).end();
  });

  return router;
}
