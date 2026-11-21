import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AMOUNT_BOUND_CENTS, FIELD_MODULUS, bytes32ToField, fieldToBytes32 } from '../../../src/ledger/field';
import { acirBytes, executeCircuit, proveCircuit, verifyProofWithVk } from '../../../src/zk/prover';
import { buildCircuitInputs } from '../../../src/zk/witness-builder';
import { PROPERTY_SEEDS, runProperty } from '../../support/pbt';
import { validWitnessArb } from '../../support/zk-arbitraries';
import { createNoirEnv, createProverEnv } from '../../support/zk-env';
import type { NoirEnv, ProverEnv } from '../../support/zk-env';

// Property 5 (Requirements 6.6, 4.10, 6.7). Runs only under `npm run test:proof`.
// Synthetic witnesses only. Nothing is printed except the seed line from `runProperty`.
// No per-test timeout here: `vitest.proof.config.ts` sets it (PROOF_TEST_TIMEOUT_MS).
const PROPERTY_CONFIG = { seed: PROPERTY_SEEDS.P5, numRuns: 3 } as const;
const RECORD_COUNT_BOUND = 2n ** 32n;
const ROOT_AT = 0;
const COUNT_AT = 1;
const LIMIT_AT = 2;

let env: ProverEnv;
let noirEnv: NoirEnv;

beforeAll(async () => {
  env = await createProverEnv();
  noirEnv = createNoirEnv();
});

afterAll(async () => {
  await env.destroy();
});

function replaced(inputs: readonly Uint8Array[], index: number, value: bigint): Uint8Array[] {
  return inputs.map((element, i) => (i === index ? fieldToBytes32(value) : element));
}

/** True only when verification returns true. A thrown error counts as rejection. */
async function accepts(vk: Uint8Array, inputs: Uint8Array[], proof: Uint8Array[]): Promise<boolean> {
  try {
    return await verifyProofWithVk(env.api, vk, inputs, proof);
  } catch {
    return false;
  }
}

// Feature: zk-spike, Property 5: A proof does not verify against a changed public input
// **Validates: Requirements 6.6**
describe('Property 5: A proof does not verify against a changed public input', () => {
  it('rejects each of three single-input changes, and accepts the unchanged inputs', async () => {
    const acir = await acirBytes(noirEnv.artifact);
    await runProperty(
      'P5 proof-tamper',
      PROPERTY_CONFIG,
      fc.asyncProperty(validWitnessArb, async (witness) => {
        const built = await buildCircuitInputs(env.hasher, {
          postings: witness.postings,
          limitCents: witness.limitCents,
        });
        const executed = await executeCircuit(noirEnv.noir, built.inputs);
        const { proof, publicInputs, vk } = await proveCircuit(env.api, acir, executed.witness);
        expect(await accepts(vk, publicInputs, proof)).toBe(true);
        const root = bytes32ToField(publicInputs[ROOT_AT] as Uint8Array);
        const count = bytes32ToField(publicInputs[COUNT_AT] as Uint8Array);
        const limit = bytes32ToField(publicInputs[LIMIT_AT] as Uint8Array);
        expect(count + 1n).toBeLessThan(RECORD_COUNT_BOUND);
        const limitOther = limit + 1n < AMOUNT_BOUND_CENTS ? limit + 1n : limit - 1n;
        const variants = [
          replaced(publicInputs, ROOT_AT, (root + 1n) % FIELD_MODULUS),
          replaced(publicInputs, COUNT_AT, count + 1n),
          replaced(publicInputs, LIMIT_AT, limitOther),
        ];
        for (const changed of variants) expect(await accepts(vk, changed, proof)).toBe(false);
      }),
    );
  });
});
