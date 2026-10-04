import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

/**
 * Encrypts Strava tokens before they are stored, with AES-256-GCM and a key from the
 * environment: a copy of the database alone gives no access to anyone's Strava account.
 */
export class TokenVault {
  private readonly key: Buffer;

  /** @param key 32 bytes, base64-encoded. */
  constructor(key: string) {
    this.key = Buffer.from(key, 'base64');
    if (this.key.length !== 32) {
      throw new Error('The Strava token key must be 32 bytes, base64-encoded.');
    }
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const parts = [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url'));
    return [VERSION, ...parts].join('.');
  }

  /** @throws when the value was not sealed with this key, or was altered. */
  open(sealed: string): string {
    const [version, iv, tag, encrypted] = sealed.split('.');
    if (version !== VERSION || !iv || !tag || encrypted === undefined) {
      throw new Error('Not a sealed token.');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
