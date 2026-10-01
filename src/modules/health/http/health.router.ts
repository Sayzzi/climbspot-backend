import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { Router } from 'express';
import { z } from 'zod';

const healthResponseSchema = z.object({ status: z.literal('ok') }).meta({ id: 'HealthResponse' });

type HealthResponse = z.infer<typeof healthResponseSchema>;

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });

  return router;
}

export function registerHealthOpenApi(registry: OpenAPIRegistry, basePath: string): void {
  registry.registerPath({
    method: 'get',
    path: basePath,
    operationId: 'getHealth',
    summary: 'Liveness probe',
    tags: ['Health'],
    responses: {
      200: {
        description: 'The API is up.',
        content: { 'application/json': { schema: healthResponseSchema } },
      },
    },
  });
}
