import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { apiErrorSchema } from '../../../shared/http/api-error.ts';
import { bearerAuth } from '../../../shared/http/identity.ts';
import { accountChangesSchema, accountSchema } from './account.schemas.ts';

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: apiErrorSchema } },
});

export function registerAccountsOpenApi(registry: OpenAPIRegistry, basePath: string): void {
  registry.registerPath({
    method: 'get',
    path: basePath,
    operationId: 'getMyAccount',
    summary: "The signed-in Visitor's account",
    description: 'Created on first use, named after the identity.',
    tags: ['Accounts'],
    security: bearerAuth,
    responses: {
      200: {
        description: 'The account.',
        content: { 'application/json': { schema: accountSchema } },
      },
      401: errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.'),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: basePath,
    operationId: 'updateMyAccount',
    summary: "Change the signed-in Visitor's display name or Flat Pace",
    tags: ['Accounts'],
    security: bearerAuth,
    request: {
      body: { required: true, content: { 'application/json': { schema: accountChangesSchema } } },
    },
    responses: {
      200: {
        description: 'The account.',
        content: { 'application/json': { schema: accountSchema } },
      },
      400: errorResponse('`VALIDATION_FAILED`: the changes are invalid.'),
      401: errorResponse('`AUTHENTICATION_REQUIRED`: nobody is signed in.'),
    },
  });
}
