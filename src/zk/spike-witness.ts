// SYNTHETIC DEMO DATA: fixed values for the zk-spike timing run. Not real accounts, amounts or customers.
//
// Spike_Witness (design "Spike-only modules"). Spike-only: nothing outside the spike modules
// imports this file. 64 postings from a fixed formula, no randomness, no padding.
//
//   slot i:      recordId = 100000001 + i
//                account  = 900000000000 + 7919 * i   (12 digits, so never a card number)
//                salt     = 5000000000 + 104729 * i
//   pair k (0..31): slot 2k is a debit and slot 2k + 1 is a credit of the same amount.
//                amount   = 150000 + 12345 * k, except when k % 8 == 7:
//                amount   = 1250000 + k with reviewFlag 1 on both slots (above the limit, flagged).
//   limitCents = 1000000, recordCount = 64.
//
// The Merkle root is not stored here. WITNESS PREP computes it at run time with the bb.js hashing.
// All money values are bigint cents.
import { FLAG_NO, FLAG_YES, SIDE_CREDIT, SIDE_DEBIT } from '../ledger/posting';
import type { Cents, Posting } from '../ledger/posting';
import type { WitnessInput } from './witness-builder';

export interface SpikeWitness extends WitnessInput {
  readonly postings: readonly Posting[];
  readonly limitCents: Cents;
  readonly recordCount: 64;
}

const PAIR_COUNT = 32;
const FLAGGED_PAIR_PERIOD = 8n;
const FLAGGED_PAIR_RESIDUE = 7n;

function buildPostings(): readonly Posting[] {
  const postings: Posting[] = [];
  for (let slot = 0; slot < PAIR_COUNT * 2; slot += 1) {
    const i = BigInt(slot);
    const k = BigInt(slot >> 1);
    const flagged = k % FLAGGED_PAIR_PERIOD === FLAGGED_PAIR_RESIDUE;
    const amountCents: Cents = flagged ? 1250000n + k : 150000n + 12345n * k;
    postings.push(
      Object.freeze({
        recordId: 100000001n + i,
        account: 900000000000n + 7919n * i,
        side: slot % 2 === 0 ? SIDE_DEBIT : SIDE_CREDIT,
        amountCents,
        reviewFlag: flagged ? FLAG_YES : FLAG_NO,
        salt: 5000000000n + 104729n * i,
      }),
    );
  }
  return Object.freeze(postings);
}

export const SPIKE_WITNESS: SpikeWitness = Object.freeze({
  postings: buildPostings(),
  limitCents: 1000000n,
  recordCount: 64,
});
