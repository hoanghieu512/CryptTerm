// fast-check arbitraries and pure helpers for the zk-spike property tests (Requirements 6.1, 6.2).
//
// Used by:
//   Property 1 (tests/zk/root-parity.prop.test.ts)    validWitnessArb, expandToSlots
//   Property 2 (tests/zk/one-cent-change.prop.test.ts) witnessWithOneCentChangeArb, applyOneCentChange
//   Property 3 (tests/zk/amount-range.prop.test.ts)    outOfRangeAmountArb, slotIndexArb
//
// A VALID witness (design.md Properties 1 to 3) is:
//   - `recordCount` in 1..64 and exactly `recordCount` real postings,
//   - the real postings balance (sum of D amounts equals sum of C amounts),
//   - every real posting has `amountCents <= limitCents` or `reviewFlag` 1,
//   - every amount below 2^40, every other slot is the single `PADDING_POSTING`
//     (added by `expandToSlots`, not stored in the witness).
//
// Everything is synthetic. Ids are at least 100000, accounts are 12 digits (100000000000 to
// 999999999999) so they can never be a PAN of 13 or more digits, and salts are random numbers.
// Nothing here prints anything.
import fc from 'fast-check';
import { AMOUNT_BOUND_CENTS, CAPACITY, FIELD_MODULUS, ID_MAX, SALT_BOUND } from '../../src/zk/field';
import {
  FLAG_NO,
  FLAG_YES,
  PADDING_POSTING,
  SIDE_CREDIT,
  SIDE_DEBIT,
} from '../../src/zk/posting';
import type { Cents, Posting, ReviewFlag, Side } from '../../src/zk/posting';

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

/** The real postings of a batch plus the policy limit. Padding slots are added by `expandToSlots`. */
export interface ValidWitness {
  readonly postings: readonly Posting[];
  readonly limitCents: Cents;
  /** A count of slots, not money. Always equals `postings.length`, in 1..64. */
  readonly recordCount: number;
}

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

/** Every posting except the balancing one has an amount of at most this value (below 2^34). */
const MAX_FREE_AMOUNT_CENTS: Cents = 2n ** 34n - 1n;

/** Largest valid limit and amount: 2^40 - 1. */
const MAX_CENTS: Cents = AMOUNT_BOUND_CENTS - 1n;

// Why the balancing amount stays valid. At most 63 postings are drawn freely, each with an amount
// of at most 2^34 - 1. The debit sum and the credit sum of those postings are each at most
// 63 * (2^34 - 1) < 64 * 2^34 = 2^40, because 63 < 64. The balancing posting takes the absolute
// difference of the two sums, which is at most the larger sum, so it is below 2^40 too. The check
// runs once at module load so that a changed constant fails loudly instead of producing an
// out-of-range amount.
if (BigInt(CAPACITY - 1) * MAX_FREE_AMOUNT_CENTS >= AMOUNT_BOUND_CENTS) {
  throw new Error('ARBITRARY BOUNDS INVALID: free amounts can sum to 2^40 or more');
}

const ACCOUNT_MIN = 100_000_000_000n; // 12 digits, never a PAN
const ACCOUNT_MAX = 999_999_999_999n;
const ID_MIN = 100_000n;
const SALT_MIN = 100_000n;

// ---------------------------------------------------------------------------------------------
// Helpers on a witness (pure)
// ---------------------------------------------------------------------------------------------

/** The 64 circuit slots: the real postings, then `PADDING_POSTING` up to `CAPACITY`. */
export function expandToSlots(w: ValidWitness): Posting[] {
  if (w.postings.length < 1 || w.postings.length > CAPACITY) {
    throw new Error('WITNESS MUST HOLD 1 TO 64 POSTINGS');
  }
  const padding = Array.from({ length: CAPACITY - w.postings.length }, () => PADDING_POSTING);
  return [...w.postings, ...padding];
}

/** Sum of D amounts and sum of C amounts over the real postings. */
export function totals(w: ValidWitness): { debit: bigint; credit: bigint } {
  let debit = 0n;
  let credit = 0n;
  for (const p of w.postings) {
    if (p.side === SIDE_DEBIT) debit += p.amountCents;
    else credit += p.amountCents;
  }
  return { debit, credit };
}

/** True when the debit sum equals the credit sum. */
export function isBalanced(w: ValidWitness): boolean {
  const { debit, credit } = totals(w);
  return debit === credit;
}

/** True when every real posting has `amountCents <= limitCents` or `reviewFlag` 1. */
export function withinLimitOrFlagged(w: ValidWitness): boolean {
  return w.postings.every((p) => p.amountCents <= w.limitCents || p.reviewFlag === FLAG_YES);
}

// ---------------------------------------------------------------------------------------------
// validWitnessArb
// ---------------------------------------------------------------------------------------------

/** One freely drawn posting before the limit is known. `flagBit` is raised by `assembleWitness`. */
interface RawPosting {
  readonly recordId: bigint;
  readonly account: bigint;
  readonly side: Side;
  readonly amountCents: Cents;
  readonly flagBit: ReviewFlag;
  readonly salt: bigint;
}

type LimitPick =
  | { readonly kind: 'fixed'; readonly limitCents: Cents }
  // The limit is taken from one of the final amounts (plus -1, 0 or +1 cent), so that postings
  // exactly at, just below and just above the limit occur often.
  | { readonly kind: 'nearAmount'; readonly index: number; readonly delta: -1n | 0n | 1n };

const sideArb: fc.Arbitrary<Side> = fc.constantFrom<Side>(SIDE_DEBIT, SIDE_CREDIT);
const flagBitArb: fc.Arbitrary<ReviewFlag> = fc.constantFrom<ReviewFlag>(FLAG_NO, FLAG_YES);

const recordIdArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 3, arbitrary: fc.bigInt({ min: ID_MIN, max: 999_999n }) },
  { weight: 2, arbitrary: fc.bigInt({ min: ID_MIN, max: ID_MAX }) },
);

const accountArb: fc.Arbitrary<bigint> = fc.bigInt({ min: ACCOUNT_MIN, max: ACCOUNT_MAX });

const saltArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 3, arbitrary: fc.bigInt({ min: SALT_MIN, max: 2n ** 24n }) },
  { weight: 3, arbitrary: fc.bigInt({ min: SALT_MIN, max: SALT_BOUND - 1n }) },
  { weight: 1, arbitrary: fc.constant(SALT_BOUND - 1n) },
);

/** Amount of a freely drawn posting: always at most 2^34 - 1. A mix of small and large values. */
const freeAmountArb: fc.Arbitrary<Cents> = fc.oneof(
  { weight: 5, arbitrary: fc.bigInt({ min: 0n, max: MAX_FREE_AMOUNT_CENTS }) },
  { weight: 3, arbitrary: fc.bigInt({ min: 0n, max: 1_000_000n }) },
  { weight: 1, arbitrary: fc.constantFrom<Cents>(0n, 1n, MAX_FREE_AMOUNT_CENTS) },
);

const rawPostingArb: fc.Arbitrary<RawPosting> = fc.record<RawPosting>({
  recordId: recordIdArb,
  account: accountArb,
  side: sideArb,
  amountCents: freeAmountArb,
  flagBit: flagBitArb,
  salt: saltArb,
});

const limitPickArb: fc.Arbitrary<LimitPick> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('fixed' as const),
      limitCents: fc.bigInt({ min: 1000n, max: 1_000_000n }),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('fixed' as const),
      limitCents: fc.bigInt({ min: 1n, max: MAX_CENTS }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('fixed' as const),
      limitCents: fc.constantFrom<Cents>(1n, 1_000_000n, MAX_CENTS),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('nearAmount' as const),
      index: fc.nat({ max: CAPACITY - 1 }),
      delta: fc.constantFrom<-1n | 0n | 1n>(-1n, 0n, 1n),
    }),
  },
);

/** Number of free postings: 0 to 63, with the two ends (recordCount 1 and 64) boosted. */
const freePostingsArb: fc.Arbitrary<RawPosting[]> = fc.oneof(
  // `size: 'max'` makes lengths range over the whole 0..63 span. With the default size, fast-check
  // keeps lengths small even when `maxLength` is given (a 3000-sample run showed 12 distinct counts).
  {
    weight: 6,
    arbitrary: fc.array(rawPostingArb, { minLength: 0, maxLength: CAPACITY - 1, size: 'max' }),
  },
  { weight: 1, arbitrary: fc.array(rawPostingArb, { minLength: 0, maxLength: 0 }) },
  {
    weight: 1,
    arbitrary: fc.array(rawPostingArb, { minLength: CAPACITY - 1, maxLength: CAPACITY - 1 }),
  },
);

function clampLimit(v: bigint): Cents {
  if (v < 1n) return 1n;
  if (v > MAX_CENTS) return MAX_CENTS;
  return v;
}

function resolveLimit(pick: LimitPick, amounts: readonly Cents[]): Cents {
  if (pick.kind === 'fixed') return pick.limitCents;
  const base = amounts[pick.index % amounts.length];
  if (base === undefined) throw new Error('WITNESS HAS NO POSTINGS');
  return clampLimit(base + pick.delta);
}

/**
 * Deterministic assembly from the raw draws, run inside a `map` so that a shrunk draw is
 * assembled again and stays valid:
 *   1. `free` postings keep their drawn side and amount (each at most 2^34 - 1),
 *   2. the last posting takes the net difference on the opposite side: net debit means a credit,
 *      net credit means a debit, and net zero (including the single-posting case) means amount 0
 *      on the side that was drawn for it,
 *   3. the limit is resolved from the final amounts,
 *   4. `reviewFlag` is 1 whenever `amountCents > limitCents`, and the drawn bit otherwise (a
 *      flagged posting under the limit is allowed).
 */
function assembleWitness(free: readonly RawPosting[], tail: RawPosting, pick: LimitPick): ValidWitness {
  let net = 0n; // debit minus credit over the free postings
  for (const p of free) {
    net += p.side === SIDE_DEBIT ? p.amountCents : -p.amountCents;
  }
  let tailSide: Side = tail.side;
  let tailAmount = 0n;
  if (net > 0n) {
    tailSide = SIDE_CREDIT;
    tailAmount = net;
  } else if (net < 0n) {
    tailSide = SIDE_DEBIT;
    tailAmount = -net;
  }
  const raw: readonly RawPosting[] = [...free, { ...tail, side: tailSide, amountCents: tailAmount }];
  const limitCents = resolveLimit(
    pick,
    raw.map((p) => p.amountCents),
  );
  const postings: Posting[] = raw.map((p) => ({
    recordId: p.recordId,
    account: p.account,
    side: p.side,
    amountCents: p.amountCents,
    reviewFlag: p.amountCents > limitCents ? FLAG_YES : p.flagBit,
    salt: p.salt,
  }));
  return { postings, limitCents, recordCount: postings.length };
}

/**
 * Valid witnesses: 1 to 64 real postings that balance, a limit in `[1, 2^40 - 1]`, and a review
 * flag wherever an amount exceeds the limit. The tail posting's own `amountCents` draw is ignored
 * (it is replaced by the net difference), which costs nothing but one unused shrink dimension.
 */
export const validWitnessArb: fc.Arbitrary<ValidWitness> = fc
  .tuple(freePostingsArb, rawPostingArb, limitPickArb)
  .map(([free, tail, pick]) => assembleWitness(free, tail, pick));

// ---------------------------------------------------------------------------------------------
// Property 2: one-cent changes
// ---------------------------------------------------------------------------------------------

export interface OneCentChange {
  /** Slot 0 to 63. Padding slots are included. */
  readonly slot: number;
  readonly delta: 1n | -1n;
}

/**
 * Every `(slot, direction)` pair whose new amount stays within `[0, 2^40 - 1]`, in slot order,
 * `+1` before `-1`. A padding slot has amount 0, so only `+1` is valid there.
 *
 * The set is never empty: there are 64 slots, and for an amount `a` in `[0, 2^40 - 1]` either
 * `a < 2^40 - 1` (so `a + 1` is valid) or `a = 2^40 - 1 > 0` (so `a - 1` is valid). A witness
 * always has at least one slot, so at least one pair exists and no run has to be skipped.
 */
export function oneCentChanges(w: ValidWitness): readonly OneCentChange[] {
  const out: OneCentChange[] = [];
  expandToSlots(w).forEach((p, slot) => {
    if (p.amountCents + 1n < AMOUNT_BOUND_CENTS) out.push({ slot, delta: 1n });
    if (p.amountCents - 1n >= 0n) out.push({ slot, delta: -1n });
  });
  if (out.length === 0) throw new Error('ONE-CENT CHANGE SET IS EMPTY');
  return out;
}

/** Draws one pair uniformly from `oneCentChanges(w)` with an index. */
export function oneCentChangeArb(w: ValidWitness): fc.Arbitrary<OneCentChange> {
  const choices = oneCentChanges(w);
  return fc.nat({ max: choices.length - 1 }).map((i) => {
    const choice = choices[i];
    if (choice === undefined) throw new Error('ONE-CENT CHANGE INDEX OUT OF RANGE');
    return choice;
  });
}

/** Draws the witness first, then one valid change for it (Property 2). */
export const witnessWithOneCentChangeArb: fc.Arbitrary<{
  readonly witness: ValidWitness;
  readonly change: OneCentChange;
}> = validWitnessArb.chain((witness) =>
  oneCentChangeArb(witness).map((change) => ({ witness, change })),
);

/** Returns a copy of `slots` (64 postings) with the amount of `change.slot` moved by one cent. */
export function applyOneCentChange(slots: readonly Posting[], change: OneCentChange): Posting[] {
  const target = slots[change.slot];
  if (target === undefined) throw new Error('ONE-CENT CHANGE SLOT OUT OF RANGE');
  const amountCents = target.amountCents + change.delta;
  if (amountCents < 0n || amountCents >= AMOUNT_BOUND_CENTS) {
    throw new Error('ONE-CENT CHANGE LEAVES THE AMOUNT RANGE');
  }
  return slots.map((p, i) => (i === change.slot ? { ...p, amountCents } : p));
}

// ---------------------------------------------------------------------------------------------
// Property 3: out-of-range amounts
// ---------------------------------------------------------------------------------------------

export const OUT_OF_RANGE_KINDS = ['aboveBound', 'near2p53', 'nearModulus'] as const;
export type OutOfRangeKind = (typeof OUT_OF_RANGE_KINDS)[number];

const TWO_POW_53 = 2n ** 53n;

/**
 * Amounts that must be rejected (all are at least 2^40):
 *   aboveBound   2^40 to 2^64 - 1
 *   near2p53     2^53 - 2 to 2^53 + 2
 *   nearModulus  FIELD_MODULUS - 2 to FIELD_MODULUS + 2 (the upper half is not a field element)
 */
export function outOfRangeAmountArb(kind: OutOfRangeKind): fc.Arbitrary<bigint> {
  switch (kind) {
    case 'aboveBound':
      return fc.bigInt({ min: AMOUNT_BOUND_CENTS, max: 2n ** 64n - 1n });
    case 'near2p53':
      return fc.bigInt({ min: TWO_POW_53 - 2n, max: TWO_POW_53 + 2n });
    case 'nearModulus':
      return fc.bigInt({ min: FIELD_MODULUS - 2n, max: FIELD_MODULUS + 2n });
  }
}

/** A slot index 0 to 63. */
export const slotIndexArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: CAPACITY - 1 });
