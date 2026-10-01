import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { DomainError, type DomainErrorKind } from '../domain/domain-error.ts';
import { toApiError } from './api-error.ts';

const statusByKind: Record<DomainErrorKind, number> = {
  invalid: 422,
  not_found: 404,
  conflict: 409,
  unauthorized: 401,
  forbidden: 403,
  too_large: 413,
  unavailable: 503,
};

/** Translates any thrown error into an {@link ApiError} response. Must be registered last. */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof DomainError) {
    res.status(statusByKind[error.kind]).json(toApiError(error.code, error.message));
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json(toApiError('VALIDATION_FAILED', 'The request is invalid.', error.issues));
    return;
  }

  if (isClientHttpError(error)) {
    res.status(error.status).json(toApiError('BAD_REQUEST', error.message));
    return;
  }

  req.log.error({ err: error }, 'Unhandled error');
  res.status(500).json(toApiError('INTERNAL_ERROR', 'An unexpected error occurred.'));
};

/** Errors raised by Express middlewares (e.g. malformed JSON body) that are safe to expose. */
function isClientHttpError(error: unknown): error is { status: number; message: string } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { status, expose } = error as { status?: unknown; expose?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}
