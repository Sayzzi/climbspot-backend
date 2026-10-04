import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

import type { ConnectionStates } from '../domain/connection-states.ts';

/** How long a Visitor has to agree on Strava's page. */
const MAXIMUM_AGE_MS = 15 * 60 * 1000;

/**
 * States only the API can make: a random part and the time it was issued, signed for
 * one Visitor with a key of their own, derived from the Strava key so that it never
 * signs with the key that encrypts tokens. They expire after fifteen minutes.
 */
export class SignedConnectionStates implements ConnectionStates {
  private readonly key: Buffer;

  /** @param key The Strava key: 32 bytes, base64. */
  constructor(
    key: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.key = Buffer.from(
      hkdfSync('sha256', Buffer.from(key, 'base64'), '', 'climbspot strava connection state', 32),
    );
  }

  issue(visitorId: string): string {
    const nonce = randomBytes(16).toString('base64url');
    const issuedAt = String(this.now().getTime());
    return [nonce, issuedAt, this.sign(visitorId, nonce, issuedAt)].join('.');
  }

  belongsTo(state: string, visitorId: string): boolean {
    const [nonce, issuedAt, signature] = state.split('.');
    if (!nonce || !issuedAt || !signature) {
      return false;
    }
    const age = this.now().getTime() - Number(issuedAt);
    if (!(age >= 0 && age <= MAXIMUM_AGE_MS)) {
      return false;
    }
    const expected = Buffer.from(this.sign(visitorId, nonce, issuedAt));
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  private sign(visitorId: string, nonce: string, issuedAt: string): string {
    return createHmac('sha256', this.key)
      .update(`${visitorId}.${nonce}.${issuedAt}`)
      .digest('base64url');
  }
}
