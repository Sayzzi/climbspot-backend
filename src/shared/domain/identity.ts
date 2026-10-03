import { DomainError } from './domain-error.ts';

/** Who a signed-in Visitor is, as their identity provider tells it (ADR 0009). */
export interface Identity {
  /** Stable id of the signed-in Visitor. */
  readonly visitorId: string;
  readonly email?: string;
  /** Name given by the identity provider, if any. */
  readonly name?: string;
}

/** Tells who a request's access token belongs to, if anyone. */
export interface IdentityVerifier {
  /** The signed-in Visitor the token proves, or `undefined` for anything else. */
  verify(token: string): Promise<Identity | undefined>;
}

/** Recognises nobody: every Visitor is signed out. */
export const nobodySignedIn: IdentityVerifier = { verify: () => Promise.resolve(undefined) };

export class AuthenticationRequiredError extends DomainError {
  readonly code = 'AUTHENTICATION_REQUIRED';
  readonly kind = 'unauthorized';

  constructor() {
    super('Sign in to do this.');
  }
}
