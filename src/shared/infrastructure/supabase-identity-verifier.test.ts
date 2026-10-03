import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { SupabaseIdentityVerifier } from './supabase-identity-verifier.ts';

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

const PROJECT = 'https://project.supabase.co';
const VISITOR = '00000000-0000-4000-8000-00000000000a';

let signingKey: SigningKey;
let otherKey: SigningKey;
let publicJwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  signingKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'key-1', alg: 'ES256' };
  otherKey = (await generateKeyPair('ES256')).privateKey;
});

const verifier = () =>
  new SupabaseIdentityVerifier({
    projectUrl: PROJECT,
    keys: createLocalJWKSet({ keys: [publicJwk] }),
  });

function token({
  key = signingKey,
  issuer = `${PROJECT}/auth/v1`,
  audience = 'authenticated',
  expiresIn = '1h',
  claims = { email: 'ada@example.com', user_metadata: { full_name: 'Ada Lovelace' } },
}: {
  key?: SigningKey;
  issuer?: string;
  audience?: string;
  expiresIn?: string | number;
  claims?: Record<string, unknown>;
} = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
    .setSubject(VISITOR)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

describe('SupabaseIdentityVerifier', () => {
  it('recognises a Visitor from a token signed by the project', async () => {
    await expect(verifier().verify(await token())).resolves.toEqual({
      visitorId: VISITOR,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });
  });

  it('takes the name from the identity provider, or leaves it out', async () => {
    await expect(
      verifier().verify(
        await token({ claims: { email: 'ada@example.com', user_metadata: { name: 'Ada' } } }),
      ),
    ).resolves.toMatchObject({ name: 'Ada' });
    await expect(
      verifier().verify(await token({ claims: { email: 'ada@example.com' } })),
    ).resolves.toEqual({ visitorId: VISITOR, email: 'ada@example.com' });
  });

  it('recognises nobody from a token signed by another key', async () => {
    await expect(verifier().verify(await token({ key: otherKey }))).resolves.toBeUndefined();
  });

  it.each([
    ['from another issuer', { issuer: 'https://elsewhere.supabase.co/auth/v1' }],
    ['for another audience', { audience: 'anon' }],
    ['expired', { expiresIn: Math.floor(Date.now() / 1000) - 60 }],
  ])('recognises nobody from a token %s', async (_, options) => {
    await expect(verifier().verify(await token(options))).resolves.toBeUndefined();
  });

  it('recognises nobody from something that is not a token', async () => {
    await expect(verifier().verify('not-a-token')).resolves.toBeUndefined();
  });
});
