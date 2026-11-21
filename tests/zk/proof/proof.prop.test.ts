import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acirBytes,
  decodePublicInputs,
  executeCircuit,
  proveCircuit,
  verifyProofWithVk,
} from '../../../src/zk/prover';
import { buildCircuitInputs } from '../../../src/zk/witness-builder';
import { PROPERTY_SEEDS, runProperty } from '../../support/pbt';
import { validWitnessArb } from '../../support/zk-arbitraries';
import { createNoirEnv, createProverEnv } from '../../support/zk-env';
import type { NoirEnv, ProverEnv } from '../../support/zk-env';

// Property 4 (Requirement 6.5, 6.7). Runs only under `npm run test:proof`.
// Synthetic witnesses only. Nothing is printed except the seed line from `runProperty`.
// No per-test timeout here: `vitest.proof.config.ts` sets it (PROOF_TEST_TIMEOUT_MS).
const PROPERTY_CONFIG = { seed: PROPERTY_SEEDS.P4, numRuns: 3 } as const;

let env: ProverEnv;
let noirEnv: NoirEnv;

beforeAll(async () => {
  env = await createProverEnv();
  noirEnv = createNoirEnv();
});

afterAll(async () => {
  await env.destroy();
});

// Feature: zk-spike, Property 4: A proof of a valid witness verifies
// **Validates: Requirements 6.5**
describe('Property 4: A proof of a valid witness verifies', () => {
  it('proves, verifies, and returns the three public inputs unchanged', async () => {
    const acir = await acirBytes(noirEnv.artifact);
    await runProperty(
      'P4 proof-verifies',
      PROPERTY_CONFIG,
      fc.asyncProperty(validWitnessArb, async (witness) => {
        const built = await buildCircuitInputs(env.hasher, {
          postings: witness.postings,
          limitCents: witness.limitCents,
        });
        const executed = await executeCircuit(noirEnv.noir, built.inputs);
        const proved = await proveCircuit(env.api, acir, executed.witness);
        const verified = await verifyProofWithVk(env.api, proved.vk, proved.publicInputs, proved.proof);
        expect(verified).toBe(true);
        expect(decodePublicInputs(proved.publicInputs)).toEqual([
          BigInt(built.inputs.merkle_root),
          BigInt(witness.recordCount),
          witness.limitCents,
        ]);
      }),
    );
  });
});
