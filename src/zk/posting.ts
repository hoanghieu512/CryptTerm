// Posting types and the leaf field order. Pure data, no validation (see `errors.ts` and the
// Witness_Builder for range checks).

/** Integer cents. Valid amounts satisfy `0 <= value < 2^40`. Never a `Number`. */
export type Cents = bigint;

/** Side: 0n = D (debit), 1n = C (credit). */
export type Side = 0n | 1n;

/** Review flag: 0n = N (not set), 1n = Y (set). */
export type ReviewFlag = 0n | 1n;

export interface Posting {
  readonly recordId: bigint; // 0 .. 2^64 - 1
  readonly account: bigint; // 0 .. 2^64 - 1
  readonly side: Side;
  readonly amountCents: Cents; // 0 .. 2^40 - 1
  readonly reviewFlag: ReviewFlag;
  readonly salt: bigint; // 0 .. 2^248 - 1
}

export const SIDE_DEBIT: Side = 0n;
export const SIDE_CREDIT: Side = 1n;
export const FLAG_NO: ReviewFlag = 0n;
export const FLAG_YES: ReviewFlag = 1n;

/** Padding slot: all six fields zero. Its leaf is `PAD_LEAF` (noir.md "Settled choices"). */
export const PADDING_POSTING: Posting = Object.freeze({
  recordId: 0n,
  account: 0n,
  side: SIDE_DEBIT,
  amountCents: 0n,
  reviewFlag: FLAG_NO,
  salt: 0n,
});

/**
 * The six leaf inputs in circuit order: `[record_id, account, side, amount, review_flag, salt]`.
 * Order recorded in `.kiro/steering/noir.md` "Settled choices" and defined by `leaf_fields`
 * in `circuits/ledger_audit/src/posting.nr`. Change both together.
 */
export function leafInputs(p: Posting): readonly [bigint, bigint, bigint, bigint, bigint, bigint] {
  return [p.recordId, p.account, p.side, p.amountCents, p.reviewFlag, p.salt];
}
