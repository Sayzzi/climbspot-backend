import { Router } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.ts';
import { createHealthModule } from './modules/health/index.ts';
import { DomainError } from './shared/domain/domain-error.ts';
import type { HttpModule } from './shared/http/http-module.ts';

class SampleNotFoundError extends DomainError {
  readonly code = 'SAMPLE_NOT_FOUND';
  readonly kind = 'not_found';
}

class SampleUnavailableError extends DomainError {
  readonly code = 'SAMPLE_UNAVAILABLE';
  readonly kind = 'unavailable';
}

function createFailingModule(): HttpModule {
  const router = Router();
  router.get('/domain', () => {
    throw new SampleNotFoundError('Sample 42 does not exist.');
  });
  router.get('/unavailable', () => {
    throw new SampleUnavailableError('The sample service is down.');
  });
  router.get('/unexpected', () => {
    throw new Error('boom');
  });

  return { basePath: '/failing', router, registerOpenApi: () => undefined };
}

function buildApp() {
  return createApp({
    logger: pino({ level: 'silent' }),
    corsOrigins: ['http://localhost:5173'],
    modules: [createHealthModule(), createFailingModule()],
  });
}

describe('createApp', () => {
  it('reports itself healthy', async () => {
    const response = await request(buildApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('serves an OpenAPI document describing the registered routes', async () => {
    const response = await request(buildApp()).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      openapi: '3.1.0',
      paths: { '/health': {} },
      components: { schemas: { ApiError: {} } },
    });
  });

  it('answers unknown routes with a ROUTE_NOT_FOUND error', async () => {
    const response = await request(buildApp()).get('/nope');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'ROUTE_NOT_FOUND' } });
  });

  it('maps domain errors to their HTTP status and stable code', async () => {
    const response = await request(buildApp()).get('/failing/domain');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'SAMPLE_NOT_FOUND', message: 'Sample 42 does not exist.' },
    });
  });

  it('reports unavailable dependencies as 503 with their stable code', async () => {
    const response = await request(buildApp()).get('/failing/unavailable');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: { code: 'SAMPLE_UNAVAILABLE', message: 'The sample service is down.' },
    });
  });

  it('hides unexpected errors behind INTERNAL_ERROR', async () => {
    const response = await request(buildApp()).get('/failing/unexpected');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  it('rejects malformed JSON bodies with BAD_REQUEST', async () => {
    const response = await request(buildApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{not json');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });
});
