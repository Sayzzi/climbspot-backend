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

const PREFIX = 'test-token-';

/** The access token a test sends to act as a Visitor: their identity, encoded. */
export const tokenFor = (visitor: Identity) =>
  `${PREFIX}${Buffer.from(JSON.stringify(visitor)).toString('base64url')}`;

/** Recognises the tokens of {@link tokenFor}, nothing else. */
export const fakeIdentityVerifier: IdentityVerifier = {
  verify: (token) =>
    Promise.resolve(
      token.startsWith(PREFIX)
        ? (JSON.parse(Buffer.from(token.slice(PREFIX.length), 'base64url').toString()) as Identity)
        : undefined,
    ),
};
