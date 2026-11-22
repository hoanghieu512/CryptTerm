import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AMOUNT_BOUND_CENTS } from '../../src/ledger/field';
import { generateBatch } from '../../src/ledger/generate';
import { LIMIT_CENTS } from '../../src/ledger/invariants';
import { batchRoot } from '../../src/zk/batch-root';
import { FieldRangeError } from '../../src/zk/errors';
import { buildCircuitInputs } from '../../src/zk/witness-builder';
import { createHasherEnv } from '../support/zk-env';
import type { HasherEnv } from '../support/zk-env';

// Requirement 5.2 and 5.4 (ledger-format). Example test with synthetic generated batches only.
// The full check against the signed samples is `samples_verify_and_roots` (group 3).

const WASM_TIMEOUT_MS = 120_000;

describe('batch-root', () => {
  let env: HasherEnv;

  beforeAll(async () => {
    env = await createHasherEnv();
  }, WASM_TIMEOUT_MS);

  afterAll(async () => {
    await env.destroy();
  });

  it(
    'equals buildCircuitInputs root for a clean batch, with a different limit',
    async () => {
      const batch = generateBatch({ kind: 'clean', seed: 1001, count: 12, batchId: 'CTB-20261201-001' });
      const built = await buildCircuitInputs(env.hasher, {
        postings: batch.postings,
        limitCents: 2n * LIMIT_CENTS,
      });
      expect(await batchRoot(env.hasher, batch)).toBe(built.merkleRoot);
    },
    WASM_TIMEOUT_MS,
  );

  it(
    'equals buildCircuitInputs root for a full 64-posting batch, with a different limit',
    async () => {
      const batch = generateBatch({ kind: 'large', seed: 1004, count: 64, batchId: 'CTB-20261201-004' });
      expect(batch.postings).toHaveLength(64);
      const built = await buildCircuitInputs(env.hasher, {
        postings: batch.postings,
        limitCents: 2n * LIMIT_CENTS,
      });
      expect(await batchRoot(env.hasher, batch)).toBe(built.merkleRoot);
    },
    WASM_TIMEOUT_MS,
  );

  it(
    'rejects an amount of 2^40 with FieldRangeError that names the field and holds no value',
    async () => {
      const clean = generateBatch({ kind: 'clean', seed: 1001, count: 12, batchId: 'CTB-20261201-001' });
      const first = clean.postings[0];
      if (first === undefined) throw new Error('TEST FIXTURE HAS NO POSTING');
      const batch = { batchId: clean.batchId, postings: [{ ...first, amountCents: AMOUNT_BOUND_CENTS }] };

      let caught: unknown;
      try {
        await batchRoot(env.hasher, batch);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(FieldRangeError);
      if (!(caught instanceof FieldRangeError)) throw new Error('UNREACHABLE');
      expect(caught.field).toBe('amountCents');
      expect(caught.slot).toBe(0);
      expect(caught.message).toBe('AMOUNT OUT OF RANGE AT SLOT 0');
      expect(caught.message.includes(AMOUNT_BOUND_CENTS.toString(10))).toBe(false);
    },
    WASM_TIMEOUT_MS,
  );
});
