// Invariant checker: three independent results for a Batch (ledger-format Requirement 4.1).
// Pure bigint arithmetic on cents. No floats.
import type { Batch } from './batch';
import { AMOUNT_BOUND_CENTS, ID_MAX, SALT_BOUND } from './field';
import { FLAG_NO, FLAG_YES, SIDE_CREDIT, SIDE_DEBIT } from './posting';
import type { Posting } from './posting';

/** Policy limit in cents (1,000,000 cents). A posting above it needs review flag Y. */
export const LIMIT_CENTS = 1000000n;

export interface InvariantResult {
  /** Sum of debit amounts equals sum of credit amounts. */
  readonly balanced: boolean;
  /** Every amount is at most `LIMIT_CENTS`, or its review flag is Y. */
  readonly withinLimitOrFlagged: boolean;
  /** Every field of every posting is in range. */
  readonly inRange: boolean;
}

function isBigintBelow(value: unknown, bound: bigint): boolean {
  return typeof value === 'bigint' && value >= 0n && value < bound;
}

function postingInRange(p: Posting): boolean {
  return (
    isBigintBelow(p.recordId, ID_MAX + 1n) &&
    isBigintBelow(p.account, ID_MAX + 1n) &&
    (p.side === SIDE_DEBIT || p.side === SIDE_CREDIT) &&
    isBigintBelow(p.amountCents, AMOUNT_BOUND_CENTS) &&
    (p.reviewFlag === FLAG_NO || p.reviewFlag === FLAG_YES) &&
    isBigintBelow(p.salt, SALT_BOUND)
  );
}

/** Checks balance, limit-or-flag and range of a batch. The three results are independent. */
export function checkInvariants(batch: Batch): InvariantResult {
  let debitCents = 0n;
  let creditCents = 0n;
  let withinLimitOrFlagged = true;
  let inRange = true;
  for (const p of batch.postings) {
    if (p.side === SIDE_DEBIT) debitCents += p.amountCents;
    else if (p.side === SIDE_CREDIT) creditCents += p.amountCents;
    if (p.amountCents > LIMIT_CENTS && p.reviewFlag !== FLAG_YES) withinLimitOrFlagged = false;
    if (!postingInRange(p)) inRange = false;
  }
  return { balanced: debitCents === creditCents, withinLimitOrFlagged, inRange };
}
