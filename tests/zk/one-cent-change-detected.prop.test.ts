import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Batch } from '../../src/ledger/batch';
import { checkBatch } from '../../src/ledger/check-batch';
import { AMOUNT_BOUND_CENTS } from '../../src/ledger/field';
import { batchRoot } from '../../src/zk/batch-root';
import { runProperty } from '../support/pbt';
import { validWitnessArb } from '../support/zk-arbitraries';
import type { ValidWitness } from '../support/zk-arbitraries';
import { createHasherEnv } from '../support/zk-env';
import type { HasherEnv } from '../support/zk-env';

// Feature: zk-core, Property 2: A one-cent change is never silent
// **Validates: Requirements 1.5**
// One real posting moves by one cent. Then checkBatch fails or batchRoot changes.
// Synthetic data only. Nothing is printed except the seed line.

const NUM_RUNS = 100;
const SEED = 20263002;
const PROPERTY_TIMEOUT_MS = 60_000;
const WASM_TIMEOUT_MS = 120_000;

let hasherEnv: HasherEnv;

beforeAll(async () => {
  hasherEnv = await createHasherEnv();
}, WASM_TIMEOUT_MS);

afterAll(async () => {
  await hasherEnv.destroy();
});

function toBatch(w: ValidWitness): Batch {
  return { batchId: 'CTB-20261201-001', postings: [...w.postings] };
}

/** The batch with the amount of posting `slot` moved by one cent, up when it can go up. */
function withCentMoved(w: ValidWitness, slot: number, preferUp: boolean): Batch {
  const index = slot % w.postings.length;
  const target = w.postings[index];
  if (target === undefined) throw new Error('FIXTURE EMPTY WITNESS');
  const canGoUp = target.amountCents + 1n < AMOUNT_BOUND_CENTS;
  const goUp = canGoUp && (preferUp || target.amountCents === 0n);
  const amountCents = goUp ? target.amountCents + 1n : target.amountCents - 1n;
  const postings = w.postings.map((p, i) => (i === index ? { ...p, amountCents } : p));
  return { batchId: 'CTB-20261201-001', postings };
}

async function rootOf(batch: Batch): Promise<bigint> {
  return batchRoot(hasherEnv.hasher, batch);
}

async function checkDraw(w: ValidWitness, slot: number, preferUp: boolean): Promise<void> {
  const original = toBatch(w);
  const changed = withCentMoved(w, slot, preferUp);
  // Control: the unchanged batch passes the pre-check.
  expect(checkBatch(original, w.limitCents).ok).toBe(true);
  const failed = !checkBatch(changed, w.limitCents).ok;
  const rootMoved = (await rootOf(original)) !== (await rootOf(changed));
  expect(failed || rootMoved).toBe(true);
}

describe('one_cent_change_detected', () => {
  it(
    'one_cent_change_detected: checkBatch fails or the root changes',
    async () => {
      const config = { seed: SEED, numRuns: NUM_RUNS };
      const draw = fc.tuple(validWitnessArb, fc.nat(), fc.boolean());
      await runProperty(
        'P2 one_cent_change_detected',
        config,
        fc.asyncProperty(draw, ([w, slot, up]) => checkDraw(w, slot, up)),
      );
    },
    PROPERTY_TIMEOUT_MS,
  );
});
