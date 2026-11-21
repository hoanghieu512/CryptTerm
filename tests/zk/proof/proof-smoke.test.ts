import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acirBytes,
  circuitSizes,
  createBb,
  decodePublicInputs,
  executeCircuit,
  proveCircuit,
  verifyProofWithVk,
} from '../../../src/zk/prover';
import type { ProveResult } from '../../../src/zk/prover';
import { SPIKE_WITNESS } from '../../../src/zk/spike-witness';
import { buildCircuitInputs } from '../../../src/zk/witness-builder';
import { createNoirEnv, createProverEnv } from '../../support/zk-env';
import type { NoirEnv, ProverEnv } from '../../support/zk-env';

// Requirements 14.2 and 14.8 (SRS point count proven by a real prove), 8.3 (the Spike_Witness
// executes), 8.12 (single thread, no COOP/COEP), 6.5 (proof timeouts sized from these timings).
// Checks U6 (circuit size against what the prover needs), U7 (no Grumpkin SRS), U10 (the
// `too many points` text), U11 (public input order) and U13 (proof time in Node).
//
// Example test. Runs only under `npm run test:proof`. The witness is the synthetic Spike_Witness.
// The only output is timings in milliseconds, counts, and the bb.js error text of the probe
// (that text names two point counts and carries no batch data). No witness value is printed.

/** Bytes per SRS g1 point in the vendored file (`bn254-g1-uncompressed-be64`). */
const BYTES_PER_POINT = 64;
const EXPECTED_RECORD_COUNT = 64n;
const EXPECTED_LIMIT_CENTS = 1000000n;
const BYTES_PER_PROOF_FIELD = 32;

function ms(value: number): string {
  return value.toFixed(1);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

let env: ProverEnv | undefined;
let noirEnv: NoirEnv | undefined;
let envMs = 0;
// Set by the first test and used by the probe.
let acir: Uint8Array | undefined;
let compressedWitness: Uint8Array | undefined;
let fullResult: ProveResult | undefined;

beforeAll(async () => {
  const start = performance.now();
  env = await createProverEnv();
  envMs = performance.now() - start;
  noirEnv = createNoirEnv();
});

afterAll(async () => {
  await env?.destroy();
});

describe('proof smoke (Spike_Witness, single thread, committed SRS)', () => {
  it('builds, executes, proves and verifies with the committed point count', async () => {
    if (env === undefined || noirEnv === undefined) throw new Error('ENV NOT READY');

    const tBuildStart = performance.now();
    const built = await buildCircuitInputs(env.hasher, SPIKE_WITNESS);
    const tBuild = performance.now() - tBuildStart;

    acir = await acirBytes(noirEnv.artifact);
    const sizes = await circuitSizes(env.api, acir);

    const tExecStart = performance.now();
    const executed = await executeCircuit(noirEnv.noir, built.inputs);
    const tExec = performance.now() - tExecStart;
    compressedWitness = executed.witness;

    // Time the prove with exactly the committed point count (Requirement 14.8).
    const tProveStart = performance.now();
    const proved = await proveCircuit(env.api, acir, compressedWitness);
    const tProve = performance.now() - tProveStart;
    fullResult = proved;

    // Verify with the key that the prove returned.
    const tVerifyStart = performance.now();
    const verified = await verifyProofWithVk(env.api, proved.vk, proved.publicInputs, proved.proof);
    const tVerify = performance.now() - tVerifyStart;

    console.info(`SRS POINTS ${env.srs.pointCount} NUM GATES ${sizes.numGates} DYADIC ${sizes.numGatesDyadic}`);
    console.info(`CREATE PROVER ENV ms ${ms(envMs)}`);
    console.info(`T_BUILD ms ${ms(tBuild)}`);
    console.info(`T_EXEC ms ${ms(tExec)}`);
    console.info(`T_PROVE ms ${ms(tProve)}`);
    console.info(`T_VERIFY ms ${ms(tVerify)}`);
    console.info(`PROOF SIZE bytes ${proved.proofSizeBytes}`);

    expect(verified).toBe(true);
    // U11: ABI order of the public parameters is [merkle_root, record_count, limit_cents].
    expect(decodePublicInputs(proved.publicInputs)).toEqual([
      BigInt(built.inputs.merkle_root),
      EXPECTED_RECORD_COUNT,
      EXPECTED_LIMIT_CENTS,
    ]);
    expect(proved.proofSizeBytes).toBe(BYTES_PER_PROOF_FIELD * proved.proof.length);
  });

  it('minimality probe: the same prove with N / 2 points', async () => {
    if (env === undefined || acir === undefined || compressedWitness === undefined) {
      throw new Error('FIRST TEST DID NOT RUN');
    }
    const halfPoints = env.srs.pointCount / 2;
    const halfSrs = {
      g1: env.srs.g1.slice(0, halfPoints * BYTES_PER_POINT),
      g2: env.srs.g2,
      pointCount: halfPoints,
    };
    // No manifest hash check on purpose: this is a deliberately truncated prefix.
    const small = await createBb(halfSrs);
    let thrown: unknown;
    let proved: ProveResult | undefined;
    try {
      proved = await proveCircuit(small, acir, compressedWitness);
    } catch (error) {
      thrown = error;
    } finally {
      await small.destroy().catch(() => undefined);
    }

    if (thrown !== undefined) {
      const text = messageOf(thrown);
      console.info(`PROBE ${halfPoints} POINTS THREW ${thrown instanceof Error ? thrown.name : typeof thrown}: ${text}`);
      // U10: the C++ error reaches the JavaScript message.
      expect(text).toContain('too many points');
    } else {
      console.info(`PROBE ${halfPoints} POINTS DID NOT THROW, PROOF BYTES ${proved?.proofSizeBytes ?? 0}`);
      expect(thrown).toBeInstanceOf(Error);
    }
    expect(fullResult).toBeDefined();
  });
});
