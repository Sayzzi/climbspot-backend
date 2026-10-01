import { AscentNotFoundError } from '../domain/ascent-errors.ts';
import type { AscentRepository } from '../domain/ascent-repository.ts';
import type { Ascent } from '../domain/ascent.ts';

export class GetAscent {
  constructor(private readonly repository: AscentRepository) {}

  async execute(id: string): Promise<Ascent> {
    const ascent = await this.repository.findById(id);
    if (ascent === undefined) {
      throw new AscentNotFoundError(id);
    }
    return ascent;
  }
}
