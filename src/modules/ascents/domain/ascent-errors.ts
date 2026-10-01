import { DomainError } from '../../../shared/domain/domain-error.ts';

export class AscentNotFoundError extends DomainError {
  readonly code = 'ASCENT_NOT_FOUND';
  readonly kind = 'not_found';

  constructor(id: string) {
    super(`No Ascent has the id ${id}.`);
  }
}

export class AscentTooLongError extends DomainError {
  readonly code = 'ASCENT_TOO_LONG';
  readonly kind = 'invalid';
}

export class AscentTooFlatError extends DomainError {
  readonly code = 'ASCENT_TOO_FLAT';
  readonly kind = 'invalid';
}

export class AscentTooLowError extends DomainError {
  readonly code = 'ASCENT_TOO_LOW';
  readonly kind = 'invalid';
}

export class AscentDipTooLargeError extends DomainError {
  readonly code = 'ASCENT_DIP_TOO_LARGE';
  readonly kind = 'invalid';
}
