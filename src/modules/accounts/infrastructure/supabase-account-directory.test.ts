import { describe, expect, it } from 'vitest';

import { SupabaseAccountDirectory } from './supabase-account-directory.ts';

const VISITOR = '00000000-0000-4000-8000-00000000000a';

function directory(status: number) {
  const sent: Request[] = [];
  const subject = new SupabaseAccountDirectory({
    projectUrl: 'https://project.supabase.co/',
    serviceRoleKey: 'service-key',
    fetch: (input, init) => {
      sent.push(new Request(input, init));
      return Promise.resolve(new Response(null, { status }));
    },
  });
  return { subject, sent };
}

describe('SupabaseAccountDirectory', () => {
  it('deletes the user through the admin API with the service-role key', async () => {
    const { subject, sent } = directory(200);

    await subject.deleteVisitor(VISITOR);

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toBe(`https://project.supabase.co/auth/v1/admin/users/${VISITOR}`);
    expect(sent[0]?.headers.get('apikey')).toBe('service-key');
    expect(sent[0]?.headers.get('Authorization')).toBe('Bearer service-key');
  });

  it('counts a user already gone as deleted', async () => {
    await expect(directory(404).subject.deleteVisitor(VISITOR)).resolves.toBeUndefined();
  });

  it('fails when Supabase refuses', async () => {
    await expect(directory(500).subject.deleteVisitor(VISITOR)).rejects.toThrow(/500/);
  });
});
