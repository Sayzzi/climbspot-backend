import { describe, expect, it } from 'vitest';

import { TokenVault } from './token-vault.ts';

const KEY = Buffer.alloc(32, 3).toString('base64');

describe('TokenVault', () => {
  it('opens what it sealed, which never shows the token', () => {
    const vault = new TokenVault(KEY);

    const sealed = vault.seal('access-token');

    expect(sealed).not.toContain('access-token');
    expect(vault.open(sealed)).toBe('access-token');
  });

  it('seals the same token differently each time', () => {
    const vault = new TokenVault(KEY);

    expect(vault.seal('token')).not.toBe(vault.seal('token'));
  });

  it('refuses a token sealed with another key, or altered', () => {
    const sealed = new TokenVault(KEY).seal('token');
    const altered = `${sealed.slice(0, -2)}AA`;

    expect(() => new TokenVault(Buffer.alloc(32, 4).toString('base64')).open(sealed)).toThrow();
    expect(() => new TokenVault(KEY).open(altered)).toThrow();
  });

  it('needs a 32-byte key', () => {
    expect(() => new TokenVault(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });
});
