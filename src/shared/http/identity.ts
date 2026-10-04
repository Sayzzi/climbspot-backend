import type { RequestHandler, Response } from 'express';

import { apiErrorSchema } from './api-error.ts';

import type { DomainError } from '../domain/domain-error.ts';
import {
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
  nobodySignedIn,
  SecondFactorRequiredError,
  type Identity,
  type IdentityVerifier,
  type SecondFactors,
} from '../domain/identity.ts';

export { nobodySignedIn, type IdentityVerifier, type SecondFactors };

/**
 * Recognises the signed-in Visitor of each request from its bearer token, if any. With
 * `secondFactors`, a session of a Visitor with a second factor that has not given its
 * code counts as nobody (ADR 0009): public routes answer as to anyone, and routes
 * needing a signed-in Visitor say why.
 */
export function identify(
  verifier: IdentityVerifier,
  secondFactors?: SecondFactors,
): RequestHandler {
  return async (req, res, next) => {
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    const identity = scheme === 'Bearer' && token ? await verifier.verify(token) : undefined;
    if (identity) {
      const withheld = await withheldFor(identity, secondFactors);
      if (withheld) {
        res.locals.withheld = withheld;
      } else {
        res.locals.identity = identity;
      }
    }
    next();
  };
}

/** Why a session proven by its token still counts as nobody, if it does. */
async function withheldFor(
  identity: Identity,
  secondFactors: SecondFactors | undefined,
): Promise<DomainError | undefined> {
  if (!secondFactors || identity.assurance === 'aal2') {
    return undefined;
  }
  try {
    return (await secondFactors.has(identity.visitorId))
      ? new SecondFactorRequiredError()
      : undefined;
  } catch (error) {
    // A second factor that switches off when Supabase fails would be none.
    return new AuthenticationUnavailableError({ cause: error });
  }
}

/** The request's signed-in Visitor, if any. */
export function visitorOf(res: Response): Identity | undefined {
  return res.locals.identity as Identity | undefined;
}

/**
 * The request's signed-in Visitor.
 *
 * @throws {AuthenticationRequiredError} when nobody is signed in.
 * @throws {SecondFactorRequiredError} when the session has not given the second factor's code.
 * @throws {AuthenticationUnavailableError} when that cannot be told right now.
 */
export function signedInVisitor(res: Response): Identity {
  const identity = visitorOf(res);
  if (identity) {
    return identity;
  }
  throw (res.locals.withheld as DomainError | undefined) ?? new AuthenticationRequiredError();
}

/** OpenAPI security requirement of endpoints that need a signed-in Visitor. */
export const bearerAuth = [{ bearerAuth: [] }];

const SECOND_FACTOR_REQUIRED =
  '`SECOND_FACTOR_REQUIRED`: the Visitor has a second factor, and this session has not given its code.';
const AUTHENTICATION_UNAVAILABLE =
  '`AUTHENTICATION_UNAVAILABLE`: whether the Visitor has a second factor cannot be told right now.';

interface OpenApiResponse {
  readonly description: string;
  readonly content?: unknown;
}

/**
 * A route's OpenAPI responses, with what any route needing a signed-in Visitor may also
 * answer: a session without the second factor's code (401), or one that cannot be
 * checked (503).
 */
export function withSignedInResponses<R extends Record<number, OpenApiResponse>>(responses: R): R {
  const add = (code: 401 | 503, description: string) => {
    const existing = responses[code];
    return {
      content: { 'application/json': { schema: apiErrorSchema } },
      ...existing,
      description: existing ? `${existing.description} ${description}` : description,
    };
  };
  return {
    ...responses,
    401: add(401, SECOND_FACTOR_REQUIRED),
    503: add(503, AUTHENTICATION_UNAVAILABLE),
  };
}

/** How the bearer scheme is described in the OpenAPI document. */
export const bearerAuthDescription = [
  'A Supabase Auth access token (ADR 0009).',
  'For a Visitor with a second factor, a token that has not given its code (`aal1`) answers 401 `SECOND_FACTOR_REQUIRED`',
  'on routes needing a signed-in Visitor, and counts as nobody elsewhere;',
  'when that cannot be checked, 503 `AUTHENTICATION_UNAVAILABLE`.',
].join(' ');
