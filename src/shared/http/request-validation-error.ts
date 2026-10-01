/**
 * A malformed request detected by the transport layer before schema validation
 * (e.g. an unexpected multipart field), answered like a schema failure:
 * 400 `VALIDATION_FAILED`.
 */
export class RequestValidationError extends Error {}
