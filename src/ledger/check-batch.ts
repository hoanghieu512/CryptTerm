// Pre-check of a batch against the circuit rules (zk-core design section E).
//
// `checkBatch` gives the terminal a clear reason before any proving work starts. It applies the
// same rules as the circuit and the Witness_Builder, in the circuit's constraint order, with
// bigint arithmetic only. It never throws and the result holds no posting value.
//
// The range rules restate `validatePosting` and `validateScalars` of `src/zk/witness-builder.ts`
// (a ledger file must not import from `src/zk`). The parity property keeps the two equal.
import type { Batch } from './batch';
import { AMOUNT_BOUND_CENTS, CAPACITY, ID_MAX, SALT_BOUND } from './field';
import type { Cents, Posting } from './posting';

export type CheckReason = 'OUT_OF_RANGE' | 'UNBALANCED' | 'OVER_LIMIT_UNFLAGGED';
export type CheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: CheckReason };

const OK: CheckResult = Object.freeze({ ok: true });
function failed(reason: CheckReason): CheckResult {
  return Object.freeze({ ok: false, reason });
}

// True for a bigint v with 0 <= v < bound. Anything else, a number included, is false.
function below(v: unknown, bound: bigint): v is bigint {
  return typeof v === 'bigint' && v >= 0n && v < bound;
}

// True for exactly 0n or exactly 1n.
function bit(v: unknown): v is 0n | 1n {
  return v === 0n || v === 1n;
}

// Field ranges of one posting. The bounds are the ones of the Witness_Builder.
function postingInRange(p: Record<string, unknown>): boolean {
  return (
    below(p['recordId'], ID_MAX + 1n) &&
    below(p['account'], ID_MAX + 1n) &&
    bit(p['side']) &&
    below(p['amountCents'], AMOUNT_BOUND_CENTS) &&
    bit(p['reviewFlag']) &&
    below(p['salt'], SALT_BOUND)
  );
}

// Stage 1 (OUT_OF_RANGE). On success the postings are known to hold only in-range bigints.
function inRangePostings(batch: Batch, limitCents: unknown): readonly Posting[] | undefined {
  const postings: unknown = batch.postings;
  if (!Array.isArray(postings)) return undefined;
  if (postings.length < 1 || postings.length > CAPACITY) return undefined;
  if (!below(limitCents, AMOUNT_BOUND_CENTS)) return undefined;
  for (const item of postings as unknown[]) {
    if (typeof item !== 'object' || item === null) return undefined;
    if (!postingInRange(item as Record<string, unknown>)) return undefined;
  }
  return postings as readonly Posting[];
}

// Stages 2 and 3: debit and credit sums, then the limit rule. Bigint sums only.
function evaluate(postings: readonly Posting[], limitCents: Cents): CheckResult {
  let debitTotal = 0n;
  let creditTotal = 0n;
  let overLimitUnflagged = false;
  for (const p of postings) {
    if (p.side === 0n) debitTotal += p.amountCents;
    else creditTotal += p.amountCents;
    if (p.amountCents > limitCents && p.reviewFlag !== 1n) overLimitUnflagged = true;
  }
  if (debitTotal !== creditTotal) return failed('UNBALANCED');
  return overLimitUnflagged ? failed('OVER_LIMIT_UNFLAGGED') : OK;
}

/**
 * First failing rule in the circuit's order: OUT_OF_RANGE, UNBALANCED, OVER_LIMIT_UNFLAGGED.
 * Any throw (a null batch, a hostile object) is reported as OUT_OF_RANGE.
 */
export function checkBatch(batch: Batch, limitCents: Cents): CheckResult {
  try {
    const postings = inRangePostings(batch, limitCents);
    return postings === undefined ? failed('OUT_OF_RANGE') : evaluate(postings, limitCents);
  } catch {
    return failed('OUT_OF_RANGE');
  }
}
