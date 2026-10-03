import type { Identity, IdentityVerifier } from '../src/shared/domain/identity.ts';

/** Signed-in Visitors the tests act as. */
export const VISITOR_A: Identity = {
  visitorId: '00000000-0000-4000-8000-00000000000a',
  email: 'ada@example.com',
  name: 'Ada',
};
export const VISITOR_B: Identity = {
  visitorId: '00000000-0000-4000-8000-00000000000b',
  email: 'bob@example.com',
};

const visitors = new Map([VISITOR_A, VISITOR_B].map((visitor) => [visitor.visitorId, visitor]));

/** The access token a test sends to act as a Visitor. */
export const tokenFor = (visitor: Identity) => `test-token-${visitor.visitorId}`;

/** Recognises the test tokens of {@link VISITOR_A} and {@link VISITOR_B}, nothing else. */
export const fakeIdentityVerifier: IdentityVerifier = {
  verify: (token) =>
    Promise.resolve(
      token.startsWith('test-token-') ? visitors.get(token.slice('test-token-'.length)) : undefined,
    ),
};
