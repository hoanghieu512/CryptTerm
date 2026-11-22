// SHA-256 as 64 lowercase hex characters, through WebCrypto. It runs the same way in the browser
// worker and in Node 24 (`crypto.subtle` is a global in both). Public values only: it is used for
// the hash of the Artifact and of the shipped verification key.

const HEX = '0123456789abcdef';

/** SHA-256 of `bytes`, as 64 lowercase hex characters. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh buffer so WebCrypto receives a plain ArrayBuffer-backed view.
  const input = new Uint8Array(bytes.length);
  input.set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  let out = '';
  for (const byte of digest) {
    out += HEX.charAt(byte >> 4) + HEX.charAt(byte & 15);
  }
  return out;
}
