import { Router } from 'express';

import type { FindUphillItineraries } from '../application/find-uphill-itineraries.ts';
import type { GenerateLoops } from '../application/generate-loops.ts';
import { toLoopItineraryResponse, toUphillItineraryResponse } from './itinerary.mapper.ts';
import { loopRequestSchema, uphillRequestSchema } from './itinerary.schemas.ts';

export interface ItinerariesRouterDependencies {
  readonly findUphillItineraries: FindUphillItineraries;
  readonly generateLoops: GenerateLoops;
}

export function createItinerariesRouter({
  findUphillItineraries,
  generateLoops,
}: ItinerariesRouterDependencies): Router {
  const router = Router();

  router.post('/loops', async (req, res) => {
    const request = loopRequestSchema.parse(req.body);
    const itineraries = await generateLoops.execute(request);
    res.json({ itineraries: itineraries.map(toLoopItineraryResponse) });
  });

  router.post('/uphill', async (req, res) => {
    const request = uphillRequestSchema.parse(req.body);
    const itineraries = await findUphillItineraries.execute(request);
    res.json({ itineraries: itineraries.map(toUphillItineraryResponse) });
  });

  return router;
}
