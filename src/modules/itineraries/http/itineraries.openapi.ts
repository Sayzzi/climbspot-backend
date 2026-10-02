import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { apiErrorSchema } from '../../../shared/http/api-error.ts';
import { uphillItinerariesSchema, uphillRequestSchema } from './itinerary.schemas.ts';

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: apiErrorSchema } },
});

export function registerItinerariesOpenApi(registry: OpenAPIRegistry, basePath: string): void {
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
