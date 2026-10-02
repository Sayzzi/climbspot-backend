import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { apiErrorSchema } from '../../../shared/http/api-error.ts';
import {
  loopItinerariesSchema,
  loopRequestSchema,
  uphillItinerariesSchema,
  uphillRequestSchema,
} from './itinerary.schemas.ts';

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: apiErrorSchema } },
});

export function registerItinerariesOpenApi(registry: OpenAPIRegistry, basePath: string): void {
  registry.registerPath({
    method: 'post',
    path: `${basePath}/loops`,
    operationId: 'generateLoops',
    summary: 'Generate Loops from a point',
    description:
      'Up to three Loops starting and ending at `start`, never shorter than `distance` and at most 20 % longer, matching Relief first. Close proposals list their `differences`.',
    tags: ['Itineraries'],
    request: {
      body: { required: true, content: { 'application/json': { schema: loopRequestSchema } } },
    },
    responses: {
      200: {
        description: 'Proposals, possibly none.',
        content: { 'application/json': { schema: loopItinerariesSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: the request is invalid.'),
      503: errorResponse('`ROUTING_UNAVAILABLE`: routing is temporarily unavailable; retry later.'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${basePath}/uphill`,
    operationId: 'findUphillItineraries',
    summary: 'Find Uphill Itineraries near a point',
    description:
      'Up to three proposals going up near `start`, never shorter than `length` and at most 20 % longer, best first. Close proposals list their `differences`.',
    tags: ['Itineraries'],
    request: {
      body: { required: true, content: { 'application/json': { schema: uphillRequestSchema } } },
    },
    responses: {
      200: {
        description: 'Proposals, possibly none.',
        content: { 'application/json': { schema: uphillItinerariesSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: the request is invalid.'),
      503: errorResponse('`ROUTING_UNAVAILABLE`: routing is temporarily unavailable; retry later.'),
    },
  });
}
