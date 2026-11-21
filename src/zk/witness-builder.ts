// Witness_Builder: validates postings, pads to 64 slots, hashes through the injected `Hasher`,
// and builds the circuit input map.
//
// Order is binding (design "Witness_Builder", Requirement 6.4):
//   1. validate `recordCount` and `limitCents`,
//   2. validate every slot in slot order, throwing on the first violation,
//   3. only then hash and build the map.
// So no hash call and no `noir_js` call happens for an invalid value, and `noir_js` never sees a
// value that makes its own error message repeat that value (design Q2).
//
// This file holds no Poseidon constants, no permutation code and no arithmetic that computes a
// hash (Requirement 3.7). Every leaf and node goes through the `Hasher` (`hash.ts`, `merkle.ts`).
// Validators compare bigints and never turn a value into a string for an error (Requirement 3.10).
import { toCircuitInputs } from './circuit-inputs';
import type { CircuitInputs } from './circuit-inputs';
import { FieldRangeError } from './errors';
import { AMOUNT_BOUND_CENTS, CAPACITY, FIELD_MODULUS, ID_MAX, SALT_BOUND } from '../ledger/field';
import type { Hasher } from './hash';
import { merkleRoot as computeMerkleRoot } from './merkle';
import { PADDING_POSTING, leafInputs } from '../ledger/posting';
import type { Cents, Posting } from '../ledger/posting';

export interface WitnessInput {
  /** Real postings only, 1 to 64. Padding is added by `buildCircuitInputs`. */
  readonly postings: readonly Posting[];
  readonly limitCents: Cents;
}

export interface BuiltInputs {
  readonly inputs: CircuitInputs;
  readonly merkleRoot: bigint;
  /** A count, not money. */
  readonly recordCount: number;
}

// The checks take `unknown` on purpose: a value that slipped in through plain JavaScript (a
// `number`, a string) fails `typeof v === 'bigint'` and is rejected like an out-of-range bigint.

/** True for a bigint `v` with `0 <= v < boundExclusive`. */
function isBelow(v: unknown, boundExclusive: bigint): boolean {
  return typeof v === 'bigint' && v >= 0n && v < boundExclusive;
}

/** True for a bigint `v` with `0 <= v <= maxInclusive`. */
function isAtMost(v: unknown, maxInclusive: bigint): boolean {
  return typeof v === 'bigint' && v >= 0n && v <= maxInclusive;
}

/** True for exactly 0n or 1n. */
function isBit(v: unknown): boolean {
  return v === 0n || v === 1n;
}

/**
 * Throws `FieldRangeError` for the first field of `p` outside its range, in field order
 * `recordId`, `account`, `side`, `amountCents`, `reviewFlag`, `salt`. The error names the field
 * and the slot and never holds the value. Applies to padding slots too.
 */
export function validatePosting(p: Posting, slot: number): void {
  if (!isAtMost(p.recordId, ID_MAX)) throw new FieldRangeError('recordId', slot);
  if (!isAtMost(p.account, ID_MAX)) throw new FieldRangeError('account', slot);
  if (!isBit(p.side)) throw new FieldRangeError('side', slot);
  if (!isBelow(p.amountCents, AMOUNT_BOUND_CENTS)) throw new FieldRangeError('amountCents', slot);
  if (!isBit(p.reviewFlag)) throw new FieldRangeError('reviewFlag', slot);
  if (!isBelow(p.salt, SALT_BOUND)) throw new FieldRangeError('salt', slot);
}

/**
 * `recordCount` must be an integer in 1..64 and `limitCents` a bigint in `[0, 2^40)`. Throws
 * `FieldRangeError` with `slot` null, `recordCount` checked first.
 */
export function validateScalars(recordCount: number, limitCents: Cents): void {
  // `recordCount` is a count of slots, not money, so `Number.isSafeInteger` is fine here.
  const countOk =
    typeof recordCount === 'number' &&
    Number.isSafeInteger(recordCount) &&
    recordCount >= 1 &&
    recordCount <= CAPACITY;
  if (!countOk) throw new FieldRangeError('recordCount', null);
  if (!isBelow(limitCents, AMOUNT_BOUND_CENTS)) throw new FieldRangeError('limitCents', null);
}

/**
 * Lower level than `buildCircuitInputs`, used by tests to craft violating witnesses. `slots` must
 * hold exactly 64 postings (a plain `Error` otherwise). Every field of every slot, padding
 * included, is range-validated before any hash call. `rootOverride` replaces the computed root in
 * the map and in the result, so a test can send a wrong root (it must still be a field element).
 */
export async function assembleCircuitInputs(
  hasher: Hasher,
  slots: readonly Posting[],
  recordCount: number,
  limitCents: Cents,
  rootOverride?: bigint,
): Promise<BuiltInputs> {
  if (slots.length !== CAPACITY) {
    throw new Error('WITNESS SLOT COUNT MUST BE 64');
  }
  validateScalars(recordCount, limitCents);
  for (let slot = 0; slot < slots.length; slot += 1) {
    const posting = slots[slot];
    if (posting === undefined) throw new Error('WITNESS SLOT IS EMPTY');
    validatePosting(posting, slot);
  }
  if (rootOverride !== undefined && !isBelow(rootOverride, FIELD_MODULUS)) {
    throw new Error('MERKLE ROOT OVERRIDE NOT A FIELD ELEMENT');
  }

  // Validation is complete. From here on the hasher is called: all 64 leaves, then 63 nodes.
  const leaves: bigint[] = [];
  for (const posting of slots) {
    leaves.push(await hasher.hashLeaf(leafInputs(posting)));
  }
  const computedRoot = await computeMerkleRoot(hasher, leaves);
  const root = rootOverride ?? computedRoot;

  return {
    inputs: toCircuitInputs(slots, root, recordCount, limitCents),
    merkleRoot: root,
    recordCount,
  };
}

/**
 * Validates the real postings and the limit, pads to 64 slots with the single `PADDING_POSTING`,
 * hashes every leaf (padding included) and the root, and builds the input map. `recordCount` is
 * the number of real postings. A count outside 1..64 throws `FieldRangeError('recordCount', null)`.
 */
export async function buildCircuitInputs(hasher: Hasher, input: WitnessInput): Promise<BuiltInputs> {
  const recordCount = input.postings.length;
  validateScalars(recordCount, input.limitCents);
  const padding = Array.from({ length: CAPACITY - recordCount }, () => PADDING_POSTING);
  return assembleCircuitInputs(hasher, [...input.postings, ...padding], recordCount, input.limitCents);
}
