import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { apiErrorSchema } from '../../../shared/http/api-error.ts';
import { bearerAuth, withSignedInResponses } from '../../../shared/http/identity.ts';
import {
  authorizationSchema,
  connectionRequestSchema,
  connectionSchema,
} from './strava.schemas.ts';

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: apiErrorSchema } },
});

const signedOut = errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.');
const connection = {
  description: 'The Strava Connection.',
  content: { 'application/json': { schema: connectionSchema } },
};

export function registerStravaOpenApi(registry: OpenAPIRegistry, basePath: string): void {
  registry.registerPath({
    method: 'get',
    path: `${basePath}/authorize`,
    operationId: 'authorizeStrava',
    summary: "Strava's authorisation page for the signed-in Visitor",
    description:
      'Strava sends the Visitor back to the frontend with a code and this state, for `POST /strava/connection`.',
    tags: ['Strava'],
    security: bearerAuth,
    responses: withSignedInResponses({
      200: {
        description: 'Where to send the Visitor.',
        content: { 'application/json': { schema: authorizationSchema } },
      },
      401: signedOut,
    }),
  });

  registry.registerPath({
    method: 'get',
    path: `${basePath}/connection`,
    operationId: 'getStravaConnection',
    summary: "The signed-in Visitor's Strava Connection",
    tags: ['Strava'],
    security: bearerAuth,
    responses: withSignedInResponses({ 200: connection, 401: signedOut }),
  });

  registry.registerPath({
    method: 'post',
    path: `${basePath}/connection`,
    operationId: 'connectStrava',
    summary: 'Make the Strava Connection with the code Strava sent back',
    description:
      'Then imports the runs and trail runs of the last three months, as far as Strava’s limits allow.',
    tags: ['Strava'],
    security: bearerAuth,
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: connectionRequestSchema } },
      },
    },
    responses: withSignedInResponses({
      200: connection,
      400: errorResponse('`VALIDATION_FAILED`: the code or state is missing.'),
      401: signedOut,
      422: errorResponse(
        '`STRAVA_AUTHORIZATION_REFUSED`: Strava refused the code, or the state is not the Visitor’s.',
      ),
      503: errorResponse('`STRAVA_UNAVAILABLE`: Strava is down or its limits are reached.'),
    }),
  });

  registry.registerPath({
    method: 'post',
    path: `${basePath}/sync`,
    operationId: 'syncStrava',
    summary: 'Import the Recorded Runs started since the latest one',
    description:
      'Runs and trail runs only. Stopping at Strava’s limits keeps what was imported; the next synchronisation carries on.',
    tags: ['Strava'],
    security: bearerAuth,
    responses: withSignedInResponses({
      200: connection,
      401: signedOut,
      409: errorResponse(
        '`STRAVA_CONNECTION_LOST`: the Visitor withdrew ClimbSpot at Strava; they need to connect again.',
      ),
      503: errorResponse(
        '`STRAVA_UNAVAILABLE`: Strava is down or its limits are reached; what was imported stays.',
      ),
    }),
  });

  registry.registerPath({
    method: 'delete',
    path: `${basePath}/connection`,
    operationId: 'endStravaConnection',
    summary: 'End the Strava Connection',
    description:
      'Withdraws ClimbSpot’s access at Strava when Strava can be reached, and erases everything kept from Strava.',
    tags: ['Strava'],
    security: bearerAuth,
    responses: withSignedInResponses({ 204: { description: 'Ended.' }, 401: signedOut }),
  });
}
