import { DomainError } from './domain-error.ts';

/** Who a signed-in Visitor is, as their identity provider tells it (ADR 0009). */
export interface Identity {
  /** Stable id of the signed-in Visitor. */
  readonly visitorId: string;
  readonly email?: string;
  /** Name given by the identity provider, if any. */
  readonly name?: string;
  /**
   * How the session was proven: `aal2` once it gave a second factor's code; `aal1`
   * (the default) otherwise.
   */
  readonly assurance?: 'aal1' | 'aal2';
}

/** Which signed-in Visitors have turned on a second factor (ADR 0009). */
export interface SecondFactors {
  /** @throws when it cannot be told, e.g. the identity provider is unreachable. */
  has(visitorId: string): Promise<boolean>;
}

/** Tells who a request's access token belongs to, if anyone. */
export interface IdentityVerifier {
  /** The signed-in Visitor the token proves, or `undefined` for anything else. */
  verify(token: string): Promise<Identity | undefined>;
}

/** Recognises nobody: every Visitor is signed out. */
export const nobodySignedIn: IdentityVerifier = { verify: () => Promise.resolve(undefined) };

/** The Visitor has a second factor, and this session has not given its code. */
export class SecondFactorRequiredError extends DomainError {
  readonly code = 'SECOND_FACTOR_REQUIRED';
  readonly kind = 'unauthorized';

  constructor() {
    super('Give the code of your second factor to do this.');
  }
}

/** Whether the Visitor has a second factor cannot be told right now. */
export class AuthenticationUnavailableError extends DomainError {
  readonly code = 'AUTHENTICATION_UNAVAILABLE';
  readonly kind = 'unavailable';

  constructor(options?: ErrorOptions) {
    super('Signing in cannot be checked right now; try again later.', options);
  }
}

export class AuthenticationRequiredError extends DomainError {
  readonly code = 'AUTHENTICATION_REQUIRED';
  readonly kind = 'unauthorized';

  constructor() {
    super('Sign in to do this.');
  }
}
