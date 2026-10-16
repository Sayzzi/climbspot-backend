import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { bearerAuth, withSignedInResponses } from '../../../shared/http/identity.ts';
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
  ascentsWithMyTimesSchema,
  createAscentBodySchema,
  favouriteAscentsSchema,
  myAscentTimesSchema,
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
    security: bearerAuth,
    responses: withSignedInResponses({
      201: {
        description: 'The Ascent was created.',
        content: { 'application/json': { schema: ascentSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: a field is missing or invalid.'),
      401: errorResponse('`AUTHENTICATION_REQUIRED`: only signed-in Visitors add Ascents.'),
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
    }),
  });

  registry.registerPath({
    method: 'get',
    path: `${basePath}/nearby`,
    operationId: 'findAscentsNearby',
    summary: 'Find the Ascents whose Start is closest to a position',
    description:
      "With a signed-in Visitor's token, each Ascent says whether it is one of their Favourite Ascents, and those they went up carry their best Ascent Time. `favourite=true` keeps only their Favourite Ascents.",
    tags: ['Ascents'],
    security: [{}, ...bearerAuth],
    request: { query: nearbyQuerySchema },
    responses: withSignedInResponses({
      200: {
        description: 'Ascents within the radius, nearest Start first. Empty when none.',
        content: { 'application/json': { schema: nearbyAscentsSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: a query parameter is missing or out of range.'),
      401: errorResponse('`AUTHENTICATION_REQUIRED`: `favourite=true` needs a signed-in Visitor.'),
    }),
  });

  registry.registerPath({
    method: 'get',
    path: `${basePath}/{id}`,
    operationId: 'getAscent',
    summary: 'Get an Ascent with its path and Elevation Profile',
    description:
      "With a signed-in Visitor's token, it says whether the Ascent is one of their Favourite Ascents.",
    tags: ['Ascents'],
    security: [{}, ...bearerAuth],
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

  registry.registerPath({
    method: 'get',
    path: `${basePath}/favourites`,
    operationId: 'listFavouriteAscents',
    summary: "The signed-in Visitor's Favourite Ascents, most recently marked first",
    description: 'Only for them, with their best Ascent Time on each when they have one.',
    tags: ['Ascents'],
    security: bearerAuth,
    responses: withSignedInResponses({
      200: {
        description: 'Their Favourite Ascents; empty when they have none.',
        content: { 'application/json': { schema: favouriteAscentsSchema } },
      },
      401: errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.'),
    }),
  });

  registry.registerPath({
    method: 'get',
    path: `${basePath}/my-times`,
    operationId: 'listAscentsWithMyTimes',
    summary: 'The Ascents the signed-in Visitor went up, the latest run first',
    description:
      'Found in their Recorded Runs through their Strava Connection; only for them, with their best, count and latest Ascent Time on each.',
    tags: ['Ascents'],
    security: bearerAuth,
    responses: withSignedInResponses({
      200: {
        description: 'The Ascents they went up; empty when none.',
        content: { 'application/json': { schema: ascentsWithMyTimesSchema } },
      },
      401: errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.'),
    }),
  });

  registry.registerPath({
    method: 'put',
    path: `${basePath}/{id}/favourite`,
    operationId: 'markFavouriteAscent',
    summary: "Make an Ascent one of the signed-in Visitor's Favourite Ascents",
    description: 'Only they see it. Marking it again changes nothing.',
    tags: ['Ascents'],
    security: bearerAuth,
    request: { params: ascentIdParamsSchema },
    responses: withSignedInResponses({
      204: { description: 'It is one of their Favourite Ascents.' },
      400: errorResponse('`VALIDATION_FAILED`: the id is not a UUID.'),
      401: errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.'),
      404: errorResponse('`ASCENT_NOT_FOUND`: no Ascent has this id.'),
    }),
  });

  registry.registerPath({
    method: 'delete',
    path: `${basePath}/{id}/favourite`,
    operationId: 'unmarkFavouriteAscent',
    summary: "Take an Ascent out of the signed-in Visitor's Favourite Ascents",
    description: 'Nothing happens when it was not one of them.',
    tags: ['Ascents'],
    security: bearerAuth,
    request: { params: ascentIdParamsSchema },
    responses: withSignedInResponses({
      204: { description: 'It is not one of their Favourite Ascents.' },
      400: errorResponse('`VALIDATION_FAILED`: the id is not a UUID.'),
      401: errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.'),
    }),
  });

  registry.registerPath({
    method: 'get',
    path: `${basePath}/{id}/my-times`,
    operationId: 'getMyAscentTimes',
    summary: "The signed-in Visitor's Ascent Times on an Ascent, newest first",
    description: 'Found in their Recorded Runs through their Strava Connection; only for them.',
    tags: ['Ascents'],
    security: bearerAuth,
    request: { params: ascentIdParamsSchema },
    responses: withSignedInResponses({
      200: {
        description: 'Their Ascent Times; empty when they have none.',
        content: { 'application/json': { schema: myAscentTimesSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: the id is not a UUID.'),
      401: errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.'),
      404: errorResponse('`ASCENT_NOT_FOUND`: no Ascent has this id.'),
    }),
  });
}
