import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import type { Router } from 'express';

/** What a business module exposes to the HTTP application. */
export interface HttpModule {
  /** Path the module's router is mounted on, e.g. `/ascents`. */
  readonly basePath: string;
  readonly router: Router;
  /** Declares the module's routes and schemas in the OpenAPI document. */
  registerOpenApi(registry: OpenAPIRegistry): void;
}
