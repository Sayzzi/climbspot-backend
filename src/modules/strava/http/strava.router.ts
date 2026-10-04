import { Router } from 'express';

import { signedInVisitor } from '../../../shared/http/identity.ts';
import type { StravaConnections } from '../application/strava-connections.ts';
import { connectionRequestSchema, toConnectionResponse } from './strava.schemas.ts';

export function createStravaRouter(connections: StravaConnections): Router {
  const router = Router();

  router.get('/authorize', (_req, res) => {
    res.json({ url: connections.authorizationUrl(signedInVisitor(res).visitorId) });
  });

  router.get('/connection', async (_req, res) => {
    res.json(toConnectionResponse(await connections.find(signedInVisitor(res).visitorId)));
  });

  router.post('/connection', async (req, res) => {
    const { visitorId } = signedInVisitor(res);
    const connection = await connections.connect(
      visitorId,
      connectionRequestSchema.parse(req.body),
    );
    res.json(toConnectionResponse(connection));
  });

  router.delete('/connection', async (_req, res) => {
    await connections.end(signedInVisitor(res).visitorId);
    res.status(204).end();
  });

  return router;
}
