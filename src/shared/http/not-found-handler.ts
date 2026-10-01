import type { RequestHandler } from 'express';

import { toApiError } from './api-error.ts';

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .json(toApiError('ROUTE_NOT_FOUND', `No route matches ${req.method} ${req.path}.`));
};
