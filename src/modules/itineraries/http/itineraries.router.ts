import { Router } from 'express';

import type { FindUphillItineraries } from '../application/find-uphill-itineraries.ts';
import { toUphillItineraryResponse } from './itinerary.mapper.ts';
import { uphillRequestSchema } from './itinerary.schemas.ts';

export interface ItinerariesRouterDependencies {
  readonly findUphillItineraries: FindUphillItineraries;
}

export function createItinerariesRouter({
  findUphillItineraries,
}: ItinerariesRouterDependencies): Router {
  const router = Router();

  router.post('/uphill', async (req, res) => {
    const request = uphillRequestSchema.parse(req.body);
    const itineraries = await findUphillItineraries.execute(request);
    res.json({ itineraries: itineraries.map(toUphillItineraryResponse) });
  });

  return router;
}
