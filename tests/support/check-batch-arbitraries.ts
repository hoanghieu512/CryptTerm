// Generators for the checkBatch tests (zk-core Requirement 1, Property 1).
// A case is a batch plus a limit, built from a valid witness with at most one planted defect,
// so that every outcome occurs often. Malformed values are planted on purpose: they reach
// checkBatch and the circuit builder through plain JavaScript. Synthetic data, nothing printed.
import fc from 'fast-check';
import type { Batch } from '../../src/ledger/batch';
import { AMOUNT_BOUND_CENTS, CAPACITY, FIELD_MODULUS } from '../../src/ledger/field';
import { FLAG_NO } from '../../src/ledger/posting';
import type { Cents, Posting } from '../../src/ledger/posting';
import { validWitnessArb } from './zk-arbitraries';
import type { ValidWitness } from './zk-arbitraries';

/** A batch and a limit. The limit may hold a planted malformed value. */
export interface CheckCase {
  readonly batch: Batch;
  readonly limitCents: Cents;
}

const BATCH_ID = 'CTB-20261201-001';

// Edges of the amount range, of double precision, of the field and of 64 bits, each with a
// few cents of offset on both sides. Negative results are dropped.
const ANCHORS: readonly bigint[] = [0n, AMOUNT_BOUND_CENTS, 2n ** 53n, FIELD_MODULUS, 2n ** 64n];
const OFFSETS: readonly bigint[] = [-2n, -1n, 0n, 1n];

export const BOUNDARY_VALUES: readonly bigint[] = [
  ...new Set(ANCHORS.flatMap((anchor) => OFFSETS.map((offset) => anchor + offset))),
].filter((v) => v >= 0n);

/** Values that are not a bigint in the field's ranges, for planted malformed fields. */
export const MALFORMED_VALUES: readonly unknown[] = [
  -1n, -(2n ** 40n), 2n, 3n, 0, 1, 1.5, NaN, '1', '', null, undefined, true, [], {},
];

/** One posting field set to any value. The cast through unknown is deliberate. */
export function withField(p: Posting, key: keyof Posting, value: unknown): Posting {
  return { ...p, [key]: value } as unknown as Posting;
}

function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

function batchOf(postings: readonly Posting[]): Batch {
  return { batchId: BATCH_ID, postings: [...postings] };
}

function postingAt(postings: readonly Posting[], slot: number): [number, Posting] {
  const index = slot % postings.length;
  const found = postings[index];
  if (found === undefined) throw new Error('FIXTURE EMPTY BATCH');
  return [index, found];
}

type Kind =
  | 'none'
  | 'overLimitUnflagged'
  | 'amountDelta'
  | 'amountSet'
  | 'flag'
  | 'side'
  | 'idField'
  | 'limit'
  | 'count';

// How often each defect is drawn, relative to the others.
const WEIGHTS: Readonly<Record<Kind, number>> = {
  none: 3,
  overLimitUnflagged: 2,
  amountDelta: 2,
  amountSet: 2,
  flag: 1,
  side: 1,
  idField: 1,
  limit: 2,
  count: 1,
};

interface Mutation {
  readonly kind: Kind;
  readonly slot: number;
  readonly pick: number;
}

const kindArb: fc.Arbitrary<Kind> = fc.oneof(
  ...(Object.entries(WEIGHTS) as [Kind, number][]).map(([kind, weight]) => ({
    weight,
    arbitrary: fc.constant(kind),
  })),
);

const mutationArb: fc.Arbitrary<Mutation> = fc
  .tuple(kindArb, fc.nat({ max: CAPACITY - 1 }), fc.nat())
  .map(([kind, slot, pick]) => ({ kind, slot, pick }));

const DELTAS: readonly bigint[] = [-1n, 1n, 2n, -100n, 100n];
const ID_KEYS: readonly (keyof Posting)[] = ['recordId', 'account', 'salt'];
const ID_VALUES: readonly unknown[] = [...MALFORMED_VALUES, 2n ** 64n, 2n ** 248n];
const LIMIT_VALUES: readonly unknown[] = [...BOUNDARY_VALUES, ...MALFORMED_VALUES];

function pickFrom<T>(items: readonly T[], n: number): T {
  if (items.length === 0) throw new Error('FIXTURE EMPTY LIST');
  // An item may itself be undefined (a planted malformed value), so only the length is checked.
  return items[n % items.length] as T;
}

/** The largest amount among the postings. */
function maxAmount(postings: readonly Posting[]): bigint {
  return postings.reduce((m, p) => (p.amountCents > m ? p.amountCents : m), 0n);
}

/** Replaces the posting at `slot` (modulo the batch size) with `change(posting)`. */
function changeSlot(postings: readonly Posting[], slot: number, change: (p: Posting) => Posting): Posting[] {
  const [index, found] = postingAt(postings, slot);
  return replaceAt(postings, index, change(found));
}

function apply(w: ValidWitness, m: Mutation): CheckCase {
  const base = w.postings;
  const same = (postings: readonly Posting[]): CheckCase => ({ batch: batchOf(postings), limitCents: w.limitCents });
  switch (m.kind) {
    case 'none':
      return same(base);
    case 'amountDelta':
      return same(changeSlot(base, m.slot, (p) => ({ ...p, amountCents: p.amountCents + pickFrom(DELTAS, m.pick) })));
    case 'amountSet':
      return same(changeSlot(base, m.slot, (p) => ({ ...p, amountCents: pickFrom(BOUNDARY_VALUES, m.pick) })));
    case 'overLimitUnflagged': {
      // Balanced and in range, but the largest amount is above the new limit and not flagged.
      const top = maxAmount(base);
      const limit = top > 0n ? top - 1n : 0n;
      const flagged = base.map((p) => (p.amountCents > limit ? { ...p, reviewFlag: FLAG_NO } : p));
      return { batch: batchOf(flagged), limitCents: limit };
    }
    case 'flag':
    case 'side':
    case 'idField': {
      const key = m.kind === 'idField' ? pickFrom(ID_KEYS, m.pick) : m.kind === 'flag' ? 'reviewFlag' : 'side';
      const value = pickFrom(m.kind === 'idField' ? ID_VALUES : MALFORMED_VALUES, m.slot + m.pick);
      return same(changeSlot(base, m.slot, (p) => withField(p, key, value)));
    }
    case 'limit':
      return { batch: batchOf(base), limitCents: pickFrom(LIMIT_VALUES, m.pick) as Cents };
    case 'count': {
      // Zero postings, or 65 (the real ones, then copies of the first posting).
      if (m.pick % 2 === 0) return same([]);
      const [, first] = postingAt(base, 0);
      return same(Array.from({ length: 65 }, (_, i) => base[i] ?? first));
    }
  }
}

/** A valid witness with one planted defect (or none). Every pre-check outcome occurs often. */
export const checkCaseArb: fc.Arbitrary<CheckCase> = fc
  .tuple(validWitnessArb, mutationArb)
  .map(([w, m]) => apply(w, m));
