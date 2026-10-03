import type { RequestHandler, Response } from 'express';

import {
  AuthenticationRequiredError,
  nobodySignedIn,
  type Identity,
  type IdentityVerifier,
} from '../domain/identity.ts';

export { nobodySignedIn, type IdentityVerifier };

/** Recognises the signed-in Visitor of each request from its bearer token, if any. */
export function identify(verifier: IdentityVerifier): RequestHandler {
  return async (req, res, next) => {
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme === 'Bearer' && token) {
      const identity = await verifier.verify(token);
      if (identity) {
        res.locals.identity = identity;
      }
    }
    next();
  };
}

/** The request's signed-in Visitor, if any. */
export function visitorOf(res: Response): Identity | undefined {
  return res.locals.identity as Identity | undefined;
}

/**
 * The request's signed-in Visitor.
 *
 * @throws {AuthenticationRequiredError} when nobody is signed in.
 */
export function signedInVisitor(res: Response): Identity {
  const identity = visitorOf(res);
  if (!identity) {
    throw new AuthenticationRequiredError();
  }
  return identity;
}

/** OpenAPI security requirement of endpoints that need a signed-in Visitor. */
export const bearerAuth = [{ bearerAuth: [] }];
