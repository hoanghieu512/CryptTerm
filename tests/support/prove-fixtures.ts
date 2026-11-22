// Small fixtures for the Prove_Service tests. The digest has the right shape but no real
// signature: the service checks shape only. The batch holds a sentinel in the private fields, so
// a test can scan messages and errors for it. Synthetic data only.
import type { Batch } from '../../src/ledger/batch';
import type { SignedDigest } from '../../src/ledger/digest';
import type { Posting } from '../../src/ledger/posting';

/** Digits planted in recordId, account and salt. No event, error or report may contain them. */
export const POSTING_SENTINEL = '918273645';
export const LIMIT = 1_000_000n;

export function shapedDigest(overrides: Partial<SignedDigest> = {}): SignedDigest {
  return {
    batchId: 'CTB-20261201-001',
    merkleRoot: `0x${'0'.repeat(63)}7`,
    recordCount: 2,
    signature: '0'.repeat(128),
    sourceKeyId: 'DEMO-0123456789abcdef',
    ...overrides,
  };
}

function posting(side: 0n | 1n, amountCents: bigint, flag: 0n | 1n, n: bigint): Posting {
  const tag = BigInt(POSTING_SENTINEL) * 1000n + n;
  return { recordId: tag, account: tag + 10n, side, amountCents, reviewFlag: flag, salt: tag + 20n };
}

// Two postings that pass the pre-check, with the sentinel in every id, account and salt.
export function sentinelBatch(amountCents = 100n): Batch {
  const postings = [posting(0n, amountCents, 0n, 1n), posting(1n, amountCents, 0n, 2n)];
  return { batchId: 'CTB-20261201-001', postings };
}
