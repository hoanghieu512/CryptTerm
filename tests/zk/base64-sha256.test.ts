import { describe, expect, it } from 'vitest';
import {
  base64ToBytesStrict,
  base64UrlToBytesStrict,
  bytesToBase64,
  bytesToBase64Url,
} from '../../src/zk/base64';
import { sha256Hex } from '../../src/zk/sha256';

// Feature: zk-core, Requirement 6. Strict base64 and base64url, and the SHA-256 helper that
// VK_HASH uses. Expected values: RFC 4648 section 10 and the FIPS 180-4 examples.

const ascii = (text: string): Uint8Array => new TextEncoder().encode(text);

// RFC 4648 test vectors as "plain:encoded" pairs.
const RFC_VECTORS = 'f:Zg==,fo:Zm8=,foo:Zm9v,foob:Zm9vYg==,fooba:Zm9vYmE=,foobar:Zm9vYmFy'.split(',');

describe('base64 vectors', () => {
  it('base64: the RFC 4648 vectors encode and decode', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
    for (const pair of RFC_VECTORS) {
      const [plain = '', encoded = ''] = pair.split(':');
      expect(bytesToBase64(ascii(plain))).toBe(encoded);
      expect(base64ToBytesStrict(encoded)).toStrictEqual(ascii(plain));
    }
  });

  it('base64: every byte value round trips through standard and url forms', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(base64ToBytesStrict(bytesToBase64(all))).toStrictEqual(all);
    expect(base64UrlToBytesStrict(bytesToBase64Url(all))).toStrictEqual(all);
    expect(bytesToBase64(all)).toBe(Buffer.from(all).toString('base64'));
    expect(bytesToBase64Url(all)).toBe(Buffer.from(all).toString('base64url'));
  });
});

// Standard base64 that must be refused: no padding, padding bits set, stray characters.
const BAD_STANDARD = 'Zg|Zh==|Zm9v\n| Zm9v|Zm9|Zm-v|Zg==Zg==|=Zg=|Zm9v!'.split('|');
// Base64url that must be refused: padding, a lone character, padding bits set, standard alphabet.
const BAD_URL = 'AA==|A|-_9|+/8|Zm9v\n|AAA=|A_-|=AAA'.split('|');

describe('base64 strictness', () => {
  it('base64: standard text that is not canonical throws a fixed message', () => {
    for (const text of BAD_STANDARD) {
      expect(() => base64ToBytesStrict(text)).toThrow('BASE64 INVALID');
    }
  });

  it('base64: url text that is not canonical throws a fixed message', () => {
    for (const text of BAD_URL) {
      expect(() => base64UrlToBytesStrict(text)).toThrow('BASE64 INVALID');
    }
    expect(base64UrlToBytesStrict('-_8')).toStrictEqual(Uint8Array.of(0xfb, 0xff));
    expect(bytesToBase64Url(Uint8Array.of(0xfb, 0xff))).toBe('-_8');
  });
});

const SHA256_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('sha256Hex known answers', () => {
  it('sha256Hex: FIPS 180-4 examples', async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe(SHA256_EMPTY);
    expect(await sha256Hex(ascii('abc'))).toBe(SHA256_ABC);
  });

  it('sha256Hex: 64 lowercase hex characters, same as node:crypto for 1000 bytes', async () => {
    const { createHash } = await import('node:crypto');
    const data = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256);
    const hex = await sha256Hex(data);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(hex).toBe(createHash('sha256').update(data).digest('hex'));
  });
});
