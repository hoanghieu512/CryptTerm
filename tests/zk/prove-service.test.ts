import { describe, expect, it } from 'vitest';
import type { Batch } from '../../src/ledger/batch';
import { ProveError } from '../../src/zk/prove-service';
import { LIMIT, sentinelBatch, shapedDigest } from '../support/prove-fixtures';
import { createRig, flush, rejection } from '../support/prove-rig';
import type { ProveRig } from '../support/prove-rig';
import type { StubOptions } from '../support/in-process-port';

// Feature: zk-core. prove_error_codes (Requirements 3.6, 4.4), prove_digest_invalid (3.7) and
// prove_precheck_rejects (3.3). Real service and worker core, stub backend, synthetic data.

// The nine reasons and their fixed messages, written out here and not read from the service.
const MESSAGE_PAIRS: readonly (readonly [string, string])[] = [
  ['BUSY', 'PROOF RUN ALREADY ACTIVE'],
  ['CANCELLED', 'PROOF RUN CANCELLED'],
  ['UNBALANCED', 'PROOF GENERATION FAILED: DEBITS NOT EQUAL TO CREDITS'],
  ['OVER_LIMIT_UNFLAGGED', 'PROOF GENERATION FAILED: POSTING OVER LIMIT WITHOUT REVIEW FLAG'],
  ['OUT_OF_RANGE', 'PROOF GENERATION FAILED: VALUE OUT OF RANGE'],
];
const WORKER_PAIRS: readonly (readonly [string, string])[] = [
  ['DIGEST_INVALID', 'PROOF GENERATION FAILED: SIGNED DIGEST INVALID'],
  ['ASSET_FAILED', 'PROOF GENERATION FAILED: PROVER ASSETS NOT AVAILABLE'],
  ['WITNESS_FAILED', 'PROOF GENERATION FAILED: WITNESS REJECTED BY CIRCUIT'],
  ['PROVER_FAILED', 'PROOF GENERATION FAILED: PROVER ERROR'],
];
const MESSAGES: Readonly<Record<string, string>> = Object.fromEntries([...MESSAGE_PAIRS, ...WORKER_PAIRS]);

const call = (rig: ProveRig, batch: Batch = sentinelBatch(), digest = shapedDigest(), limit = LIMIT) =>
  rig.service.proveBatch(batch, digest, limit, rig.onProgress);

// A two-posting batch with its own debit and credit amounts and one review flag.
function twoPostings(debit: bigint, credit: bigint, flag: 0n | 1n = 0n): Batch {
  const [d, c] = sentinelBatch().postings;
  if (d === undefined || c === undefined) throw new Error('FIXTURE POSTINGS MISSING');
  return { batchId: 'CTB-20261201-001', postings: [{ ...d, amountCents: debit, reviewFlag: flag }, { ...c, amountCents: credit, reviewFlag: flag }] };
}

// The error that one scenario ends with. A scenario starts its own rig.
async function errorOf(options: StubOptions, run: (rig: ProveRig) => Promise<unknown>): Promise<unknown> {
  return rejection(run(createRig(options)));
}

// A second call while one run is held.
async function busyError(): Promise<unknown> {
  const rig = createRig({ hold: true });
  const first = call(rig);
  await flush();
  const second = await rejection(call(rig));
  rig.control.release();
  await first;
  return second;
}

// Cancel a held run.
async function cancelledError(): Promise<unknown> {
  const rig = createRig({ hold: true });
  const pending = rejection(call(rig));
  await flush();
  rig.service.cancelProve();
  return pending;
}

const BAD_SIGNATURE = shapedDigest({ signature: '0' });

const SCENARIOS: Readonly<Record<string, () => Promise<unknown>>> = {
  BUSY: busyError,
  CANCELLED: cancelledError,
  UNBALANCED: () => errorOf({}, (rig) => call(rig, twoPostings(100n, 101n))),
  OVER_LIMIT_UNFLAGGED: () => errorOf({}, (rig) => call(rig, twoPostings(2_000_000n, 2_000_000n))),
  OUT_OF_RANGE: () => errorOf({}, (rig) => call(rig, twoPostings(2n ** 40n, 2n ** 40n))),
  DIGEST_INVALID: () => errorOf({}, (rig) => call(rig, sentinelBatch(), BAD_SIGNATURE)),
  ASSET_FAILED: () => errorOf({ failAt: 'openProver' }, call),
  WITNESS_FAILED: () => errorOf({ failAt: 'hash' }, call),
  PROVER_FAILED: () => errorOf({ failAt: 'prove' }, call),
};

describe('prove_error_codes', () => {
  it('prove_error_codes: each of the nine reasons has its fixed message', async () => {
    expect(Object.keys(SCENARIOS)).toStrictEqual(Object.keys(MESSAGES));
    for (const [reason, scenario] of Object.entries(SCENARIOS)) {
      const error = await scenario();
      expect(error).toBeInstanceOf(ProveError);
      expect((error as ProveError).reason).toBe(reason);
      expect((error as ProveError).message).toBe(MESSAGES[reason]);
      expect('cause' in (error as ProveError)).toBe(false);
    }
  });
});

describe('prove_error_codes prover output', () => {
  it('prove_error_codes: a wrong proof element size from the prover is PROVER_FAILED', async () => {
    const error = await errorOf({ elementBytes: 31 }, (rig) => call(rig));
    expect((error as ProveError).reason).toBe('PROVER_FAILED');
  });

  it('prove_error_codes: the bundle holds the public inputs the prover returned', async () => {
    const rig = createRig({ publicInputs: [11n, 22n, 33n] });
    const bundle = await call(rig, sentinelBatch(), shapedDigest({ recordCount: 9 }), 2_000_000n);
    expect(bundle.publicInputs).toStrictEqual(['11', '22', '33']);
    expect([bundle.recordCount, bundle.limitCents]).toStrictEqual([9, 2_000_000n]);
  });
});
