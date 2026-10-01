import { DomainError } from '../../../shared/domain/domain-error.ts';

export class AscentNotFoundError extends DomainError {
  readonly code = 'ASCENT_NOT_FOUND';
  readonly kind = 'not_found';

  constructor(id: string) {
    super(`No Ascent has the id ${id}.`);
  }
}
