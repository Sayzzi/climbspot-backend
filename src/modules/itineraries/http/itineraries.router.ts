import { Router } from 'express';

import type { Planner } from '../application/cached-planner.ts';
import type {
  HillSession,
  HillSessionRequest,
  LoopItinerary,
  LoopRequest,
  UphillItinerary,
  UphillRequest,
} from '../domain/itinerary.ts';
import {
  toHillSessionResponse,
  toLoopItineraryResponse,
  toUphillItineraryResponse,
} from './itinerary.mapper.ts';
import {
  hillSessionRequestSchema,
  loopRequestSchema,
  uphillRequestSchema,
} from './itinerary.schemas.ts';

export interface ItinerariesRouterDependencies {
  readonly findUphillItineraries: Planner<UphillRequest, UphillItinerary[]>;
  readonly generateLoops: Planner<LoopRequest, LoopItinerary[]>;
  readonly planHillSessions: Planner<HillSessionRequest, HillSession[]>;
}

export function createItinerariesRouter({
  findUphillItineraries,
  generateLoops,
  planHillSessions,
}: ItinerariesRouterDependencies): Router {
  const router = Router();

  router.post('/loops', async (req, res) => {
    const request = loopRequestSchema.parse(req.body);
    const itineraries = await generateLoops.execute(request);
    res.json({
      itineraries: itineraries.map((itinerary) =>
        toLoopItineraryResponse(itinerary, request.activity),
      ),
    });
  });

  router.post('/uphill', async (req, res) => {
    const request = uphillRequestSchema.parse(req.body);
    const itineraries = await findUphillItineraries.execute(request);
    res.json({
      itineraries: itineraries.map((itinerary) =>
        toUphillItineraryResponse(itinerary, request.activity),
      ),
    });
  });

  router.post('/sessions', async (req, res) => {
    const request = hillSessionRequestSchema.parse(req.body);
    const sessions = await planHillSessions.execute(request);
    res.json({ sessions: sessions.map(toHillSessionResponse) });
  });

  return router;
}
