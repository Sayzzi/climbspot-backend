import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';

import { createApp } from '../src/app.ts';
import type { RoutingProvider } from '../src/modules/itineraries/domain/routing-provider.ts';
import { createItinerariesModule } from '../src/modules/itineraries/index.ts';

/** The HTTP application with the Itineraries module over a given routing provider. */
export function itinerariesApp(routingProvider: RoutingProvider): Express {
  return createApp({
    logger: pino({ level: 'silent' }),
    corsOrigins: [],
    modules: [createItinerariesModule({ routingProvider })],
  });
}

export function askUphill(app: Express, body: Record<string, unknown>) {
  return request(app).post('/itineraries/uphill').send(body);
}

export function askLoops(app: Express, body: Record<string, unknown>) {
  return request(app).post('/itineraries/loops').send(body);
}
