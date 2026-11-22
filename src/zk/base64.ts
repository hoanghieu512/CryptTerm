// Base64 and base64url (RFC 4648), strict on input. No `Buffer`, no `atob`, no `btoa`, so the
// same code runs in a worker, in a page and in Node. The decoders accept only the canonical text
// of the bytes they return: same alphabet, exact padding, zero padding bits. Anything else throws
// `Error('BASE64 INVALID')`, a fixed message that holds no part of the input.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const STANDARD = `${LETTERS}+/`;
// The url alphabet swaps the last two symbols: `-` for `+` and `_` for `/`.
const URL_SAFE = `${LETTERS}-_`;
const INVALID = 'BASE64 INVALID';

/** Encodes with `alphabet`, and appends `=` padding when `pad` is true. */
function encode(bytes: Uint8Array, alphabet: string, pad: boolean): string {
  const fill = pad ? '=' : '';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const left = bytes.length - i;
    out += alphabet.charAt((chunk >> 18) & 63) + alphabet.charAt((chunk >> 12) & 63);
    out += left > 1 ? alphabet.charAt((chunk >> 6) & 63) : fill;
    out += left > 2 ? alphabet.charAt(chunk & 63) : fill;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return encode(bytes, STANDARD, true);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return encode(bytes, URL_SAFE, false);
}

const STANDARD_TABLE: ReadonlyMap<string, number> = new Map([...STANDARD].map((c, i) => [c, i]));
const URL_TABLE: ReadonlyMap<string, number> = new Map([...URL_SAFE].map((c, i) => [c, i]));

/** Decodes symbols with no padding. Leftover bits are dropped here and checked by the callers. */
function decodeSymbols(symbols: string, table: ReadonlyMap<string, number>): Uint8Array {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const symbol of symbols) {
    const value = table.get(symbol);
    if (value === undefined) throw new Error(INVALID);
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 255);
      acc &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

/** Canonical base64 with padding to bytes. Throws `BASE64 INVALID` for any other text. */
export function base64ToBytesStrict(text: string): Uint8Array {
  if (typeof text !== 'string' || text.length % 4 !== 0) throw new Error(INVALID);
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const bytes = decodeSymbols(text.slice(0, text.length - padding), STANDARD_TABLE);
  // Re-encoding must give the input back, which rejects set padding bits.
  if (bytesToBase64(bytes) !== text) throw new Error(INVALID);
  return bytes;
}

/** Canonical base64url without padding to bytes. Throws `BASE64 INVALID` for any other text. */
export function base64UrlToBytesStrict(text: string): Uint8Array {
  if (typeof text !== 'string' || text.length % 4 === 1) throw new Error(INVALID);
  const bytes = decodeSymbols(text, URL_TABLE);
  if (bytesToBase64Url(bytes) !== text) throw new Error(INVALID);
  return bytes;
}
