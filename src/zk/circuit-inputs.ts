// The input map that `noir_js` `Noir.execute` takes for the `ledger_audit` circuit.
//
// Keys equal the ABI parameter names in `src/zk/artifacts/ledger_audit.json` (`abi.parameters`):
// `merkle_root`, `record_count`, `limit_cents` (public) and `postings` (private, 64 entries of
// `record_id`, `account`, `side`, `amount`, `review_flag`, `salt`).
//
// `InputValue` in `@noir-lang/types` 1.0.0 is `string | number | boolean | InputMap | InputValue[]`.
// There is no `bigint`, and `abiEncode` rejects numbers above 2^53 - 1, so every integer and field
// element is a decimal string (design Q2, E-3). This file only formats; it validates nothing and
// computes nothing (range checks are in `witness-builder.ts`).
import type { Cents, Posting } from '../ledger/posting';
import { CAPACITY } from '../ledger/field';

// These are `type` aliases and not `interface`s on purpose. `InputMap` is
// `{ [key: string]: InputValue }`. A type alias of an object literal type is assignable to an index
// signature type, an interface is not, so `Noir.execute(inputs)` needs no cast and no helper.
// `postings` is a mutable array because `InputValue[]` is mutable.

/** One posting slot as the circuit ABI wants it. Every value is a decimal string. */
export type CircuitPosting = {
  record_id: string;
  account: string;
  side: string;
  amount: string;
  review_flag: string;
  salt: string;
};

/** The full input map: three public values and exactly `CAPACITY` (64) postings. */
export type CircuitInputs = {
  merkle_root: string;
  record_count: string;
  limit_cents: string;
  postings: CircuitPosting[];
};

function decimal(v: bigint): string {
  return v.toString(10);
}

function toCircuitPosting(p: Posting): CircuitPosting {
  return {
    record_id: decimal(p.recordId),
    account: decimal(p.account),
    side: decimal(p.side),
    amount: decimal(p.amountCents),
    review_flag: decimal(p.reviewFlag),
    salt: decimal(p.salt),
  };
}

/**
 * Formats already validated values as the circuit input map. `slots` must hold exactly `CAPACITY`
 * postings (real ones first, then padding). Throws a plain `Error` with a fixed message otherwise
 * (a programming error, never a value). `recordCount` is a count, so it is a `number` and becomes
 * a decimal string here.
 */
export function toCircuitInputs(
  slots: readonly Posting[],
  merkleRoot: bigint,
  recordCount: number,
  limitCents: Cents,
): CircuitInputs {
  if (slots.length !== CAPACITY) {
    throw new Error('CIRCUIT INPUT SLOT COUNT MUST BE 64');
  }
  return {
    merkle_root: decimal(merkleRoot),
    record_count: String(recordCount),
    limit_cents: decimal(limitCents),
    postings: slots.map(toCircuitPosting),
  };
}
