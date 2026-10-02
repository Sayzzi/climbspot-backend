import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { apiErrorSchema } from '../../../shared/http/api-error.ts';
import {
  MAXIMUM_GPX_FILE_SIZE,
  MAXIMUM_LENGTH,
  MAXIMUM_PATH_POINTS,
  MINIMUM_AVERAGE_GRADIENT,
  MINIMUM_ELEVATION_GAIN,
} from '../domain/ascent-rules.ts';
import { DIP_ALLOWANCE, DIP_ALLOWANCE_RATIO } from '../../../shared/domain/survey/survey-rules.ts';
import {
  ascentIdParamsSchema,
  ascentSchema,
  createAscentBodySchema,
  nearbyAscentsSchema,
  nearbyQuerySchema,
} from './ascent.schemas.ts';

// Descriptions are built from the domain rules so they never drift from them.
const megabytes = (bytes: number) => `${String(bytes / 1024 / 1024)} MB`;
const kilometres = (metres: number) => `${String(metres / 1000)} km`;
const percent = (ratio: number) => `${String(ratio * 100)} %`;
const count = (value: number) => value.toLocaleString('en');

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
      413: errorResponse(
        `\`GPX_TOO_LARGE\`: the file exceeds ${megabytes(MAXIMUM_GPX_FILE_SIZE)} or its path has more than ${count(MAXIMUM_PATH_POINTS)} points.`,
      ),
      422: errorResponse(
        [
          'The upload cannot become an Ascent:',
          '`GPX_INVALID` (not a valid GPX file), `GPX_EMPTY` (no track or route with two distinct points),',
          `\`ASCENT_TOO_LONG\` (over ${kilometres(MAXIMUM_LENGTH)}), \`ASCENT_TOO_LOW\` (gains under ${String(MINIMUM_ELEVATION_GAIN)} m),`,
          `\`ASCENT_TOO_FLAT\` (averages under ${percent(MINIMUM_AVERAGE_GRADIENT)}) or \`ASCENT_DIP_TOO_LARGE\` (loses more than the larger of ${String(DIP_ALLOWANCE)} m and ${percent(DIP_ALLOWANCE_RATIO)} of its Elevation Gain in Dips).`,
        ].join(' '),
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
