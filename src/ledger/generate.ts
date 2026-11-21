// Seeded batch generator, the simulated core ledger (ledger-format design.md "Generator").
//
// DEMO ONLY. Seeded salts are for demo determinism: the same options give the same bytes on
// every run, so the committed samples are reproducible. The salts are not random and must
// never be used for a real batch. Real batches use random salts.
//
// The draw order below is part of the contract. Changing it changes every sample.
// No clock, no platform randomness, no logging. All money and ids are bigint.
import type { Batch } from './batch';
import { CAPACITY, SALT_BOUND } from './field';
import { LIMIT_CENTS } from './invariants';
import { FLAG_NO, FLAG_YES, SIDE_CREDIT, SIDE_DEBIT } from './posting';
import type { Posting, ReviewFlag, Side } from './posting';
import { createPrng } from './prng';

export type GeneratorKind = 'clean' | 'overLimitUnflagged' | 'unbalanced' | 'large';

export interface GenerateOptions {
  readonly kind: GeneratorKind;
  /** Non-negative safe integer. */
  readonly seed: number;
  /** Integer 2 to 64. Kind `large` requires 64. */
  readonly count: number;
  readonly batchId: string;
}

const MIN_COUNT = 2;
const FIRST_RECORD_ID = 100000n;
const ACCOUNT_BASE = 100000000000n; // 12 digits, a synthetic account number and never a card number
const ACCOUNT_SPAN = 900000000000n; // accounts are 100000000000 .. 999999999999
const CLASS_BOUND = 8n; // class 0 of 8 makes a group over-limit

interface Draft {
  readonly side: Side;
  amountCents: bigint;
  readonly account: bigint;
  readonly salt: bigint;
}

function validate(opts: GenerateOptions): void {
  const { seed, count, kind } = opts;
  if (typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0) {
    throw new Error('GENERATOR SEED INVALID');
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < MIN_COUNT || count > CAPACITY) {
    throw new Error('GENERATOR COUNT INVALID');
  }
  if (kind === 'large' && count !== CAPACITY) {
    throw new Error('GENERATOR LARGE REQUIRES 64');
  }
}

/**
 * Generates a batch of `count` postings. Groups: `count / 2` pairs if `count` is even, else
 * `(count - 3) / 2` pairs and one final triple. A pair is D `a`, C `a`. A triple is D `a`,
 * C `b`, C `a - b`. Every group balances.
 */
export function generateBatch(opts: GenerateOptions): Batch {
  validate(opts);
  const { kind, seed, count, batchId } = opts;
  const prng = createPrng(seed);
  const limit = LIMIT_CENTS;

  const odd = count % 2 === 1;
  const pairCount = odd ? (count - 3) / 2 : count / 2;
  const groupCount = pairCount + (odd ? 1 : 0);

  const drafts: Draft[] = [];
  const drawIdentity = (side: Side, amountCents: bigint): Draft => {
    // Draw order inside a posting: account, then salt.
    const account = ACCOUNT_BASE + prng.nextBelow(ACCOUNT_SPAN);
    const salt = prng.nextBelow(SALT_BOUND);
    return { side, amountCents, account, salt };
  };

  for (let group = 0; group < groupCount; group += 1) {
    const isTriple = odd && group === groupCount - 1;
    // 1. class
    const cls = prng.nextBelow(CLASS_BOUND);
    // 2. over-limit decision
    const over = kind === 'overLimitUnflagged' ? group === 0 : cls === 0n || group === 1;
    // 3. amount
    let amount: bigint;
    if (over) {
      amount = limit + 1n + prng.nextBelow(limit);
    } else if (isTriple) {
      amount = 2n + prng.nextBelow(limit - 1n);
    } else {
      amount = 1n + prng.nextBelow(limit);
    }
    if (isTriple) {
      // 4. split of the credit side
      const b = 1n + prng.nextBelow(amount - 1n);
      // 5. per posting, in group order
      drafts.push(drawIdentity(SIDE_DEBIT, amount));
      drafts.push(drawIdentity(SIDE_CREDIT, b));
      drafts.push(drawIdentity(SIDE_CREDIT, amount - b));
    } else {
      drafts.push(drawIdentity(SIDE_DEBIT, amount));
      drafts.push(drawIdentity(SIDE_CREDIT, amount));
    }
  }

  if (kind === 'unbalanced') {
    // The last posting is always a credit. One extra cent unbalances the batch by exactly 1.
    const last = drafts[drafts.length - 1];
    if (last !== undefined) {
      last.amountCents += 1n;
    }
  }

  // Flags are set after all amounts are final. Y exactly when the amount is above the limit.
  const postings: Posting[] = drafts.map((draft, slot) => {
    let reviewFlag: ReviewFlag = draft.amountCents > limit ? FLAG_YES : FLAG_NO;
    if (kind === 'overLimitUnflagged' && slot === 0) {
      reviewFlag = FLAG_NO;
    }
    return {
      recordId: FIRST_RECORD_ID + BigInt(slot),
      account: draft.account,
      side: draft.side,
      amountCents: draft.amountCents,
      reviewFlag,
      salt: draft.salt,
    };
  });

  return { batchId, postings };
}
