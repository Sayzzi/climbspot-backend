import { createHmac, timingSafeEqual } from 'node:crypto';

import type { ConnectionStates } from '../domain/connection-states.ts';

/** States signed with a secret key: only the API can make one for a Visitor. */
export class SignedConnectionStates implements ConnectionStates {
  constructor(private readonly key: string) {}

  issue(visitorId: string): string {
    return createHmac('sha256', this.key)
      .update(`strava-connection:${visitorId}`)
      .digest('base64url');
  }

  belongsTo(state: string, visitorId: string): boolean {
    const expected = Buffer.from(this.issue(visitorId));
    const given = Buffer.from(state);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
