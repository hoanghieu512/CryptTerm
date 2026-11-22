import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { SignedDigest } from '../../src/ledger/digest';
import { bundleToJson, decodeBundle, rootToDigestHex } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { CIRCUIT_VERSION, VK_HASH } from '../../src/zk/circuit-identity';
import { hexStringArb, validRootArb, validTripleArb } from '../support/digest-arbitraries';
import { runProperty } from '../support/pbt';
import { POSTING_SENTINEL, sentinelBatch, shapedDigest } from '../support/prove-fixtures';
import { createRig } from '../support/prove-rig';
import { validWitnessArb } from '../support/zk-arbitraries';
import type { ValidWitness } from '../support/zk-arbitraries';

// Feature: zk-core. Property 3, stub-run half of bundle_allow_list (Requirements 3.4, 5.1 to 5.4),
// and Property 4, prove_assembles_bundle (Requirement 3.4). Real service and worker core, stub
// prover. Synthetic data only.
const ALLOW_LIST = ['batch_id record_count merkle_root limit_cents signature', 'source_key_id proof circuit_version verification_key_hash public_inputs']
  .join(' ')
  .split(' ');

// A digest with the right shape and random content. The service checks shape, not the signature.
const digestArb: fc.Arbitrary<SignedDigest> = fc
  .tuple(validTripleArb, hexStringArb(128), hexStringArb(16))
  .map(([t, signature, id]) =>
    shapedDigest({
      batchId: t.batchId,
      merkleRoot: rootToDigestHex(t.merkleRoot),
      recordCount: t.recordCount,
      signature,
      sourceKeyId: `DEMO-${id}`,
    }),
  );

// What the stub prover returns as public inputs, unrelated to the digest and the limit.
const inputsArb: fc.Arbitrary<[bigint, bigint, bigint]> = fc.tuple(validRootArb, validRootArb, validRootArb);

// The stub proof: three elements of 32 bytes, filled with 1, 2 and 3.
const STUB_PROOF = Uint8Array.from([1, 2, 3].flatMap((fill) => new Array<number>(32).fill(fill)));

async function assembled(digest: SignedDigest, limit: bigint, inputs: [bigint, bigint, bigint], batch = sentinelBatch()) {
  const rig = createRig({ publicInputs: inputs });
  return rig.service.proveBatch(batch, digest, limit);
}

function checkAssembly(digest: SignedDigest, limit: bigint, inputs: [bigint, bigint, bigint], bundle: ProofBundle): void {
  const fromDigest = [digest.batchId, BigInt(digest.merkleRoot), digest.recordCount, digest.signature, digest.sourceKeyId];
  expect([bundle.batchId, bundle.merkleRoot, bundle.recordCount, bundle.signature, bundle.sourceKeyId]).toStrictEqual(fromDigest);
  expect(bundle.limitCents).toBe(limit);
  expect(bundle.publicInputs).toStrictEqual(inputs.map((v) => v.toString(10)));
  expect([bundle.circuitVersion, bundle.vkHash]).toStrictEqual([CIRCUIT_VERSION, VK_HASH]);
  expect(bundle.proof).toStrictEqual(STUB_PROOF);
}

type Inputs = [bigint, bigint, bigint];

async function assemblyRun([digest, witness, inputs]: [SignedDigest, ValidWitness, Inputs]): Promise<void> {
  const batch = { batchId: digest.batchId, postings: [...witness.postings] };
  const bundle = await assembled(digest, witness.limitCents, inputs, batch);
  checkAssembly(digest, witness.limitCents, inputs, bundle);
}

describe('prove_assembles_bundle', () => {
  it('prove_assembles_bundle: fields come from the digest, the argument and the prover output', async () => {
    const draw = fc.tuple(digestArb, validWitnessArb, inputsArb);
    await runProperty('P4 prove_assembles_bundle', { seed: 20263004, numRuns: 100 }, fc.asyncProperty(draw, assemblyRun));
  });
});

// Sentinel postings go through the whole run. The bundle keeps its ten keys and no posting value.
async function allowListRun([digest, amount, inputs]: [SignedDigest, bigint, Inputs]): Promise<void> {
  const bundle = await assembled(digest, 1_000_000n, inputs, sentinelBatch(amount));
  const text = bundleToJson(bundle);
  expect(Object.keys(JSON.parse(text) as object)).toStrictEqual(ALLOW_LIST);
  expect(text).not.toContain(POSTING_SENTINEL);
  expect(decodeBundle(text)).toStrictEqual(bundle);
  expect(bundle.proof.length).toBeGreaterThan(0);
}

describe('bundle_allow_list stub run', () => {
  it('bundle_allow_list: a proved bundle has the ten keys and no posting value', async () => {
    const draw = fc.tuple(digestArb, fc.bigInt({ min: 1n, max: 1_000_000n }), inputsArb);
    const config = { seed: 20263003, numRuns: 100 };
    await runProperty('P3 bundle_allow_list stub run', config, fc.asyncProperty(draw, allowListRun));
  });
});
