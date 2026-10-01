import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { apiErrorSchema } from './api-error.ts';
import type { HttpModule } from './http-module.ts';

type OpenApiDefinition = OpenAPIRegistry['definitions'][number];

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

/**
 * Shared schemas published as components even before any route references them.
 * Wrapped in a `schema` definition: zod 4 schemas expose their own `type` property,
 * which the generator would otherwise mistake for a definition type.
 */
const sharedSchemas: OpenApiDefinition[] = [{ type: 'schema', schema: apiErrorSchema }];

export function buildOpenApiDocument(modules: readonly HttpModule[]): OpenApiDocument {
  const registry = new OpenAPIRegistry();

  for (const module of modules) {
    module.registerOpenApi(registry);
  }

  return new OpenApiGeneratorV31([...registry.definitions, ...sharedSchemas]).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'ClimbSpot API',
      version: '0.1.0',
      description: 'Find and catalogue uphill paths for running and cycling.',
    },
  });
}
