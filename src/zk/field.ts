// Field constants and 32-byte big-endian conversion for the BN254 scalar field.
//
// Values here are shared by the circuit (`circuits/ledger_audit`) and the TypeScript
// hashing. Source of truth: `.kiro/steering/noir.md` "Settled choices".

/**
 * BN254 scalar field modulus (the field of Noir `Field` and of bb.js `Fr`).
 * Equals `BN254_FR_MODULUS` in `@aztec-foundation/bb.js` 6.0.0
 * (`dest/node/cbind/generated/curve_constants.js`) and `Fr.MODULUS` in
 * `src/barretenberg/testing/fields.ts` (0x30644e72...0000001).
 */
export const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Number of posting slots in the circuit (`N` in `main.nr`). A count, not money. */
export const CAPACITY = 64 as const;

/** Exclusive upper bound of an amount in cents: valid amounts are `0 <= amount < 2^40`. */
export const AMOUNT_BOUND_CENTS = 2n ** 40n;

/** Inclusive upper bound of `recordId` and `account`: unsigned 64-bit. */
export const ID_MAX = 2n ** 64n - 1n;

/** Exclusive upper bound of `salt`: valid salts are `0 <= salt < 2^248` (31 bytes). */
export const SALT_BOUND = 2n ** 248n;

const BYTES_32 = 32;
const WORD_BYTES = 8; // a 32-byte element is four big-endian 64-bit words
const WORD_COUNT = 4;
const WORD_BITS = 64n;
const WORD_MASK = 2n ** 64n - 1n;

/**
 * Encode a field element as 32 bytes, big-endian.
 *
 * This is an internal invariant check, not a posting validation: callers must already have
 * validated posting fields (which throws `FieldRangeError` with a field and slot). The error
 * message is fixed and never contains the value.
 */
export function fieldToBytes32(v: bigint): Uint8Array {
  if (v < 0n || v >= FIELD_MODULUS) {
    throw new Error('FIELD ELEMENT OUT OF RANGE');
  }
  const out = new Uint8Array(BYTES_32);
  const view = new DataView(out.buffer);
  let rest = v;
  for (let i = WORD_COUNT - 1; i >= 0; i -= 1) {
    view.setBigUint64(i * WORD_BYTES, rest & WORD_MASK, false);
    rest >>= WORD_BITS;
  }
  return out;
}

/**
 * Decode 32 big-endian bytes into a field element. Requires exactly 32 bytes and a value
 * below `FIELD_MODULUS`. Error messages are fixed and never contain the value.
 */
export function bytes32ToField(b: Uint8Array): bigint {
  if (b.length !== BYTES_32) {
    throw new Error('FIELD ELEMENT MUST BE 32 BYTES');
  }
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let v = 0n;
  for (let i = 0; i < WORD_COUNT; i += 1) {
    v = (v << WORD_BITS) | view.getBigUint64(i * WORD_BYTES, false);
  }
  if (v >= FIELD_MODULUS) {
    throw new Error('FIELD ELEMENT OUT OF RANGE');
  }
  return v;
}
