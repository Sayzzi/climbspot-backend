export type DomainErrorKind =
  | 'invalid'
  | 'not_found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  /** The input exceeds a size limit. */
  | 'too_large'
  /** A dependency the operation relies on is temporarily down; retrying later may succeed. */
  | 'unavailable';

/**
 * Base class for every business rule violation.
 *
 * `code` is a stable identifier that clients translate into the user's language;
 * `kind` tells the transport layer how to report it, so the domain never knows about HTTP.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
