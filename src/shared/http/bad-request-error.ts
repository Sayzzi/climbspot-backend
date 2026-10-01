/** A malformed request detected by the transport layer, answered with 400 `BAD_REQUEST`. */
export class BadRequestError extends Error {
  readonly status = 400;
  readonly expose = true;
}
