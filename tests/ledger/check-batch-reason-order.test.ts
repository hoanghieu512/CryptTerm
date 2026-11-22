import { describe, expect, it } from 'vitest';
import type { Batch } from '../../src/ledger/batch';
import { checkBatch } from '../../src/ledger/check-batch';
import type { CheckReason } from '../../src/ledger/check-batch';
import type { Cents, Posting } from '../../src/ledger/posting';

// Feature: zk-core, Requirement 1.3. Examples for `checkBatch_reason_order`: when several rules
// break, the first of OUT_OF_RANGE, UNBALANCED, OVER_LIMIT_UNFLAGGED is returned.
// All values are synthetic.

const LIMIT: Cents = 1_000_000n;

function posting(side: 0n | 1n, amountCents: Cents, reviewFlag: 0n | 1n, n: number): Posting {
  return {
    recordId: BigInt(100000 + n),
    account: 100000000000n + BigInt(n),
    side,
    amountCents,
    reviewFlag,
    salt: 900000n + BigInt(n),
  };
}

function batchOf(postings: readonly Posting[]): Batch {
  return { batchId: 'CTB-20261201-001', postings: [...postings] };
}

type Expected = 'OK' | CheckReason;

interface Row {
  readonly name: string;
  readonly batch: Batch;
  readonly limit: Cents;
  readonly expected: Expected;
}

const TWO_POW_40 = 2n ** 40n;
const BIG = 2_000_000n;

/** A debit and a credit with their own amounts and flags. */
function pair(debit: Cents, credit: Cents, debitFlag: 0n | 1n = 0n, creditFlag: 0n | 1n = 0n): Batch {
  return batchOf([posting(0n, debit, debitFlag, 1), posting(1n, credit, creditFlag, 2)]);
}

function row(name: string, batch: Batch, limit: Cents, expected: Expected): Row {
  return { name, batch, limit, expected };
}

const ROWS: readonly Row[] = [
  row('balanced and within the limit', pair(100n, 100n), LIMIT, 'OK'),
  row('amount equal to the limit, no flag', pair(LIMIT, LIMIT), LIMIT, 'OK'),
  row('over the limit, both flagged', pair(BIG, BIG, 1n, 1n), LIMIT, 'OK'),
  row('credit flagged only, one cent over', pair(LIMIT + 1n, LIMIT + 1n, 0n, 1n), LIMIT, 'OVER_LIMIT_UNFLAGGED'),
  row('unbalanced and over the limit', pair(BIG, LIMIT), LIMIT, 'UNBALANCED'),
  row('unbalanced by a single cent', pair(500n, 499n), LIMIT, 'UNBALANCED'),
  row('amount 2^40 and unbalanced', pair(TWO_POW_40, 5n), LIMIT, 'OUT_OF_RANGE'),
  row('limit 2^40', pair(5n, 5n), TWO_POW_40, 'OUT_OF_RANGE'),
  row('negative limit', pair(5n, 5n), -1n, 'OUT_OF_RANGE'),
  row('no postings', batchOf([]), LIMIT, 'OUT_OF_RANGE'),
];

function expectedResult(e: Expected): unknown {
  return e === 'OK' ? { ok: true } : { ok: false, reason: e };
}

/** `count` alternating debits and credits of 10 cents, so an even count balances. */
function alternating(count: number): Batch {
  const list = Array.from({ length: count }, (_, i) => posting(i % 2 === 0 ? 0n : 1n, 10n, 0n, i));
  return batchOf(list);
}

describe('checkBatch_reason_order', () => {
  it.each(ROWS)('checkBatch_reason_order: $name', (row) => {
    expect(checkBatch(row.batch, row.limit)).toStrictEqual(expectedResult(row.expected));
  });

  it('checkBatch_reason_order: capacity bounds are 1 to 64 postings', () => {
    expect(checkBatch(alternating(64), LIMIT)).toStrictEqual({ ok: true });
    expect(checkBatch(alternating(65), LIMIT)).toStrictEqual(expectedResult('OUT_OF_RANGE'));
  });
});

describe('checkBatch_reason_order malformed runtime values', () => {
  const mate = posting(1n, 5n, 0n, 2);

  it('checkBatch_reason_order: a number amount and a side of 2 are out of range', () => {
    const numberAmount = { ...posting(0n, 5n, 0n, 1), amountCents: 5 };
    const sideTwo = { ...posting(0n, 5n, 0n, 1), side: 2n };
    for (const bad of [numberAmount, sideTwo]) {
      const result = checkBatch(batchOf([bad as unknown as Posting, mate]), LIMIT);
      expect(result).toStrictEqual(expectedResult('OUT_OF_RANGE'));
    }
  });

  it('checkBatch_reason_order: a null batch and a number limit never throw', () => {
    expect(checkBatch(null as unknown as Batch, LIMIT)).toStrictEqual(expectedResult('OUT_OF_RANGE'));
    expect(checkBatch(alternating(2), 7 as unknown as Cents)).toStrictEqual(expectedResult('OUT_OF_RANGE'));
  });
});
