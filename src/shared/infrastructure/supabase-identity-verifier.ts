import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { Identity, IdentityVerifier } from '../domain/identity.ts';

export interface SupabaseIdentityVerifierOptions {
  /** The Supabase project, e.g. https://abcd.supabase.co. */
  readonly projectUrl: string;
  /** Public signing keys; by default the project's published key set. */
  readonly keys?: JWTVerifyGetKey;
}

interface SupabaseClaims {
  readonly email?: string;
  /** Authenticator assurance level: `aal2` once the session gave a second factor's code. */
  readonly aal?: string;
  readonly user_metadata?: { readonly full_name?: string; readonly name?: string };
}

/** Verifies Supabase Auth access tokens against the project's public signing keys (ADR 0009). */
export class SupabaseIdentityVerifier implements IdentityVerifier {
  private readonly issuer: string;
  private readonly keys: JWTVerifyGetKey;

  constructor({ projectUrl, keys }: SupabaseIdentityVerifierOptions) {
    this.issuer = `${projectUrl.replace(/\/$/, '')}/auth/v1`;
    this.keys = keys ?? createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<Identity | undefined> {
    try {
      const { payload } = await jwtVerify<SupabaseClaims>(token, this.keys, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      if (!payload.sub) {
        return undefined;
      }
      const name = payload.user_metadata?.full_name ?? payload.user_metadata?.name;
      return {
        visitorId: payload.sub,
        ...(payload.email && { email: payload.email }),
        ...(name && { name }),
        assurance: payload.aal === 'aal2' ? 'aal2' : 'aal1',
      };
    } catch {
      // Expired, forged or malformed: nobody is signed in.
      return undefined;
    }
  }
}
