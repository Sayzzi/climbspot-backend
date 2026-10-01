import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { apiErrorSchema } from '../../../shared/http/api-error.ts';
import {
  ascentIdParamsSchema,
  ascentSchema,
  createAscentBodySchema,
  nearbyAscentsSchema,
  nearbyQuerySchema,
} from './ascent.schemas.ts';

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: apiErrorSchema } },
});

export function registerAscentsOpenApi(registry: OpenAPIRegistry, basePath: string): void {
  registry.registerPath({
    method: 'post',
    path: basePath,
    operationId: 'createAscent',
    summary: 'Catalogue an Ascent from a GPX file',
    tags: ['Ascents'],
    request: {
      body: {
        required: true,
        content: { 'multipart/form-data': { schema: createAscentBodySchema } },
      },
    },
    responses: {
      201: {
        description: 'The Ascent was created.',
        content: { 'application/json': { schema: ascentSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: a field is missing or invalid.'),
      403: errorResponse(
        '`ASCENT_CREATION_DISABLED`: creating Ascents is disabled on this server.',
      ),
      503: errorResponse(
        '`ELEVATION_UNAVAILABLE`: the terrain model cannot be reached; retry later.',
      ),
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${basePath}/nearby`,
    operationId: 'findAscentsNearby',
    summary: 'Find the Ascents whose Start is closest to a position',
    tags: ['Ascents'],
    request: { query: nearbyQuerySchema },
    responses: {
      200: {
        description: 'Ascents within the radius, nearest Start first. Empty when none.',
        content: { 'application/json': { schema: nearbyAscentsSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: a query parameter is missing or out of range.'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${basePath}/{id}`,
    operationId: 'getAscent',
    summary: 'Get an Ascent with its path and Elevation Profile',
    tags: ['Ascents'],
    request: { params: ascentIdParamsSchema },
    responses: {
      200: {
        description: 'The Ascent.',
        content: { 'application/json': { schema: ascentSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: the id is not a UUID.'),
      404: errorResponse('`ASCENT_NOT_FOUND`: no Ascent has this id.'),
    },
  });
}
