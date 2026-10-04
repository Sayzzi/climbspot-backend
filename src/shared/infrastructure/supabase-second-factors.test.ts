import { describe, expect, it } from 'vitest';

import { SupabaseSecondFactors } from './supabase-second-factors.ts';

const VISITOR = '00000000-0000-4000-8000-00000000000a';

function factors(answer: () => Response) {
  const sent: Request[] = [];
  const subject = new SupabaseSecondFactors({
    projectUrl: 'https://project.supabase.co/',
    serviceRoleKey: 'service-key',
    fetch: (input, init) => {
      sent.push(new Request(input, init));
      return Promise.resolve(answer());
    },
  });
  return { subject, sent };
}

describe('SupabaseSecondFactors', () => {
  it('reads the user through the admin API with the service-role key', async () => {
    const { subject, sent } = factors(() =>
      Response.json({ id: VISITOR, factors: [{ status: 'verified', factor_type: 'totp' }] }),
    );

    expect(await subject.has(VISITOR)).toBe(true);
    expect(sent[0]?.url).toBe(`https://project.supabase.co/auth/v1/admin/users/${VISITOR}`);
    expect(sent[0]?.headers.get('apikey')).toBe('service-key');
  });

  it.each([
    ['no factor', { id: VISITOR }],
    ['only an unverified factor', { id: VISITOR, factors: [{ status: 'unverified' }] }],
  ])('says no for %s', async (_, user) => {
    expect(await factors(() => Response.json(user)).subject.has(VISITOR)).toBe(false);
  });

  it('says no for a user gone, and fails when Supabase does', async () => {
    expect(await factors(() => new Response(null, { status: 404 })).subject.has(VISITOR)).toBe(
      false,
    );
    await expect(
      factors(() => new Response(null, { status: 500 })).subject.has(VISITOR),
    ).rejects.toThrow(/500/);
  });
});
