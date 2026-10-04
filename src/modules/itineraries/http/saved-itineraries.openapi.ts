import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { apiErrorSchema } from '../../../shared/http/api-error.ts';
import { bearerAuth, withSignedInResponses } from '../../../shared/http/identity.ts';
import {
  newSavedItinerarySchema,
  savedItinerariesSchema,
  savedItineraryChangesSchema,
  savedItinerarySchema,
} from './saved-itinerary.schemas.ts';

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: apiErrorSchema } },
});

const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });

const signedIn = { tags: ['Saved Itineraries'], security: bearerAuth };
const unauthorized = errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.');
const notFound = errorResponse(
  '`SAVED_ITINERARY_NOT_FOUND`: the signed-in Visitor has no such Saved Itinerary.',
);
const idParameter = { params: z.object({ id: z.string() }) };

export function registerSavedItinerariesOpenApi(registry: OpenAPIRegistry, basePath: string): void {
  registry.registerPath({
    ...signedIn,
    method: 'post',
    path: basePath,
    operationId: 'saveItinerary',
    summary: 'Keep a proposal as a Saved Itinerary',
    description: 'A frozen copy of a Loop, Uphill Itinerary or Hill Session, as proposed.',
    request: { body: { required: true, ...json(newSavedItinerarySchema) } },
    responses: withSignedInResponses({
      201: { description: 'The Saved Itinerary.', ...json(savedItinerarySchema) },
      400: errorResponse('`VALIDATION_FAILED`: the name or the proposal is invalid.'),
      401: unauthorized,
      413: errorResponse('`SAVED_ITINERARY_TOO_LARGE`: the proposal is too large to keep.'),
    }),
  });

  registry.registerPath({
    ...signedIn,
    method: 'get',
    path: basePath,
    operationId: 'listSavedItineraries',
    summary: "The signed-in Visitor's Saved Itineraries, newest first",
    responses: withSignedInResponses({
      200: { description: 'Their summaries.', ...json(savedItinerariesSchema) },
      401: unauthorized,
    }),
  });

  registry.registerPath({
    ...signedIn,
    method: 'get',
    path: `${basePath}/{id}`,
    operationId: 'getSavedItinerary',
    summary: 'A Saved Itinerary with its proposal',
    request: idParameter,
    responses: withSignedInResponses({
      200: { description: 'The Saved Itinerary.', ...json(savedItinerarySchema) },
      401: unauthorized,
      404: notFound,
    }),
  });

  registry.registerPath({
    ...signedIn,
    method: 'patch',
    path: `${basePath}/{id}`,
    operationId: 'renameSavedItinerary',
    summary: 'Rename a Saved Itinerary',
    request: { ...idParameter, body: { required: true, ...json(savedItineraryChangesSchema) } },
    responses: withSignedInResponses({
      200: { description: 'The Saved Itinerary.', ...json(savedItinerarySchema) },
      400: errorResponse('`VALIDATION_FAILED`: the name is invalid.'),
      401: unauthorized,
      404: notFound,
    }),
  });

  registry.registerPath({
    ...signedIn,
    method: 'delete',
    path: `${basePath}/{id}`,
    operationId: 'deleteSavedItinerary',
    summary: 'Delete a Saved Itinerary',
    request: idParameter,
    responses: withSignedInResponses({
      204: { description: 'Deleted.' },
      401: unauthorized,
      404: notFound,
    }),
  });
}
