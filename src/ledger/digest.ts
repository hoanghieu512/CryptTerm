// Signed digest of a batch: the message that the core ledger signs, and the browser-side check.
//
// The browser VERIFIES and never signs (security.md rule 2, Requirement 7.1). This file uses
// `crypto.subtle.importKey` (public key, `verify` usage only) and `crypto.subtle.verify`.
// Nothing here creates, exports or reads a private key.
//
// Message layout (ledger-format design.md "Digest"), 71 bytes, all fields at fixed offsets:
//   offset  0, 19 bytes  ASCII `CRYPTTERM-DIGEST-V1`
//   offset 19, 16 bytes  batchId, ASCII
//   offset 35, 32 bytes  merkleRoot, big-endian (`fieldToBytes32`)
//   offset 67,  4 bytes  recordCount, uint32 big-endian
import { BATCH_ID_PATTERN } from './batch';
import { CAPACITY, FIELD_MODULUS, fieldToBytes32 } from './field';

const DOMAIN_TAG = 'CRYPTTERM-DIGEST-V1';
const TAG_LENGTH = 19;
const BATCH_ID_LENGTH = 16;
const ROOT_LENGTH = 32;
const COUNT_LENGTH = 4;
const ROOT_OFFSET = TAG_LENGTH + BATCH_ID_LENGTH;
const COUNT_OFFSET = ROOT_OFFSET + ROOT_LENGTH;
const MESSAGE_LENGTH = COUNT_OFFSET + COUNT_LENGTH;

const PUBLIC_KEY_BYTES = 32;
const SIGNATURE_BYTES = 64;

export const ROOT_HEX_PATTERN = /^0x[0-9a-f]{64}$/;
export const SIGNATURE_HEX_PATTERN = /^[0-9a-f]{128}$/;
const PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** The fixed error message of `digestMessage`. It never holds an input value. */
const DIGEST_INPUT_INVALID = 'DIGEST INPUT INVALID';

/** A signed digest, also the content of each `.digest.json`. Key order is part of the format. */
export interface SignedDigest {
  readonly batchId: string;
  /** `0x` plus 64 lowercase hex characters. */
  readonly merkleRoot: string;
  readonly recordCount: number;
  /** 64-byte Ed25519 signature, 128 lowercase hex characters. */
  readonly signature: string;
  /** `DEMO-` plus 16 lowercase hex characters. */
  readonly sourceKeyId: string;
}

/** True when `batchId`, `merkleRoot` and `recordCount` are all valid digest inputs. */
function isValidTriple(batchId: unknown, merkleRoot: unknown, recordCount: unknown): boolean {
  if (typeof batchId !== 'string' || !BATCH_ID_PATTERN.test(batchId)) return false;
  if (typeof merkleRoot !== 'bigint' || merkleRoot < 0n || merkleRoot >= FIELD_MODULUS) return false;
  if (typeof recordCount !== 'number' || !Number.isSafeInteger(recordCount)) return false;
  return recordCount >= 1 && recordCount <= CAPACITY;
}

/**
 * The 71-byte message that is signed. Throws an `Error` with the fixed message
 * `DIGEST INPUT INVALID` for a `batchId` that does not match `BATCH_ID_PATTERN`, a root outside
 * `0 <= root < FIELD_MODULUS`, or a count that is not an integer from 1 to `CAPACITY`.
 */
export function digestMessage(batchId: string, merkleRoot: bigint, recordCount: number): Uint8Array {
  if (!isValidTriple(batchId, merkleRoot, recordCount)) {
    throw new Error(DIGEST_INPUT_INVALID);
  }
  const out = new Uint8Array(MESSAGE_LENGTH);
  for (let i = 0; i < TAG_LENGTH; i += 1) {
    out[i] = DOMAIN_TAG.charCodeAt(i);
  }
  for (let i = 0; i < BATCH_ID_LENGTH; i += 1) {
    out[TAG_LENGTH + i] = batchId.charCodeAt(i);
  }
  out.set(fieldToBytes32(merkleRoot), ROOT_OFFSET);
  new DataView(out.buffer).setUint32(COUNT_OFFSET, recordCount, false);
  return out;
}

/** Value of one lowercase hex digit by char code, or -1. */
function hexDigit(code: number): number {
  if (code >= 48 && code <= 57) return code - 48; // 0-9
  if (code >= 97 && code <= 102) return code - 97 + 10; // a-f
  return -1;
}

/** Strict lowercase hex to bytes. The caller has already checked the pattern and the length. */
function hexToBytes(hex: string, byteLength: number): Uint8Array<ArrayBuffer> {
  if (hex.length !== byteLength * 2) throw new Error(DIGEST_INPUT_INVALID);
  const out = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    const high = hexDigit(hex.charCodeAt(2 * i));
    const low = hexDigit(hex.charCodeAt(2 * i + 1));
    if (high < 0 || low < 0) throw new Error(DIGEST_INPUT_INVALID);
    out[i] = high * 16 + low;
  }
  return out;
}

const DIGEST_KEYS: readonly string[] = ['batchId', 'merkleRoot', 'recordCount', 'signature', 'sourceKeyId'];

/** A plain object with exactly the five digest keys as own properties, and no others. */
export function hasExactDigestKeys(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== DIGEST_KEYS.length) return false;
  return DIGEST_KEYS.every((name) => keys.includes(name));
}

/**
 * Resolves `true` if and only if `digest` is a well-formed `SignedDigest` whose Ed25519
 * signature, checked through `crypto.subtle` against the 32-byte public key `publicKeyHex`,
 * covers `digestMessage` of its `batchId`, `merkleRoot` and `recordCount`.
 *
 * Fails closed: any wrong shape, wrong type, malformed hex, out-of-range root or count,
 * unusable key, missing platform support or thrown exception resolves `false`. It never throws
 * and never rejects. The caller looks up `publicKeyHex` from `TRUSTED_SOURCE_KEYS` by
 * `sourceKeyId`; an unknown id is a rejection by the caller.
 */
export async function verifyDigest(digest: unknown, publicKeyHex: unknown): Promise<boolean> {
  try {
    if (!hasExactDigestKeys(digest)) return false;
    const batchId = digest.batchId;
    const merkleRootHex = digest.merkleRoot;
    const recordCount = digest.recordCount;
    const signatureHex = digest.signature;
    const sourceKeyId = digest.sourceKeyId;

    if (typeof batchId !== 'string' || typeof sourceKeyId !== 'string') return false;
    if (typeof merkleRootHex !== 'string' || !ROOT_HEX_PATTERN.test(merkleRootHex)) return false;
    if (typeof signatureHex !== 'string' || !SIGNATURE_HEX_PATTERN.test(signatureHex)) return false;
    if (typeof publicKeyHex !== 'string' || !PUBLIC_KEY_HEX_PATTERN.test(publicKeyHex)) return false;
    if (typeof recordCount !== 'number') return false;

    const merkleRoot = BigInt(merkleRootHex);
    // The same rules as `digestMessage`: batch id pattern, root below the field modulus,
    // count an integer from 1 to CAPACITY. `digestMessage` throws on a violation, which the
    // surrounding `try` turns into `false`.
    const built = digestMessage(batchId, merkleRoot, recordCount);
    // Copy into a fresh buffer so WebCrypto receives a plain `ArrayBuffer`-backed view.
    const message = new Uint8Array(built.length);
    message.set(built);

    const keyBytes = hexToBytes(publicKeyHex, PUBLIC_KEY_BYTES);
    const signatureBytes = hexToBytes(signatureHex, SIGNATURE_BYTES);

    // Read at call time, inside the try, so a missing or failing platform returns false.
    const subtle = crypto.subtle;
    const key = await subtle.importKey('raw', keyBytes, 'Ed25519', false, ['verify']);
    const valid: unknown = await subtle.verify('Ed25519', key, signatureBytes, message);
    return valid === true;
  } catch {
    return false;
  }
}
