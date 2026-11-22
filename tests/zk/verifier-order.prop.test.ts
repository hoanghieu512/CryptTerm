import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIELD_MODULUS } from '../../src/ledger/field';
import { bundleToJson } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { createVerifier } from '../../src/zk/verifier';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { makeEphemeralKeys } from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';
import { runProperty } from '../support/pbt';
import { POLICY_LIMIT, recordingVerifier, signedBundle, testDeps } from '../support/signed-bundle';

// Feature: zk-core, Property 8: step order, stop at the first failure, verdict (verifier_order).
// Validates: Requirements 8.1, 8.2, 8.4. One fault per step is injected, alone or together.
const ORDER = ['FORMAT', 'SIGNATURE', 'DIGEST_MATCH', 'POLICY', 'CIRCUIT', 'PROOF'] as const;
type Fault = (typeof ORDER)[number];

let key: EphemeralKey;

beforeAll(async () => {
  const keys = await makeEphemeralKeys(1);
  key = keys[0] as EphemeralKey;
});

// The text of `bundle` with the faults of the first five steps applied. FORMAT cuts the text.
function faultyText(bundle: ProofBundle, faults: ReadonlySet<Fault>): string {
  let b = bundle;
  if (faults.has('SIGNATURE')) b = { ...b, signature: (b.signature[0] === '0' ? '1' : '0') + b.signature.slice(1) };
  if (faults.has('DIGEST_MATCH')) {
    const next = ((BigInt(b.publicInputs[0]) + 1n) % FIELD_MODULUS).toString(10);
    b = { ...b, publicInputs: [next, b.publicInputs[1], b.publicInputs[2]] };
  }
  if (faults.has('POLICY')) b = { ...b, limitCents: b.limitCents + 1n };
  if (faults.has('CIRCUIT')) b = { ...b, circuitVersion: `${b.circuitVersion}x` };
  const text = bundleToJson(b);
  return faults.has('FORMAT') ? text.slice(0, -1) : text;
}

// The steps that must be reported: up to and including the earliest fault, or all six.
function expectedSteps(faults: ReadonlySet<Fault>): readonly Fault[] {
  const first = ORDER.findIndex((step) => faults.has(step));
  return first < 0 ? ORDER : ORDER.slice(0, first + 1);
}

async function checkOrder(base: ProofBundle, faultList: readonly Fault[]): Promise<void> {
  const faults = new Set(faultList);
  const bundle = await signedBundle(key, base);
  const proof = recordingVerifier(!faults.has('PROOF'));
  const verify = createVerifier(testDeps(key, proof.verifyProof));
  const report = await verify(faultyText(bundle, faults), { limitCents: POLICY_LIMIT });
  const names = expectedSteps(faults);
  expect(report.steps.map((s) => s.name)).toStrictEqual([...names]);
  // Every step before the earliest fault passed, and the last one failed if there was a fault.
  expect(report.steps.map((s) => s.ok)).toStrictEqual(names.map((_, i) => faults.size === 0 || i < names.length - 1));
  expect(report.verdict).toBe(faults.size === 0 ? 'VERIFIED' : 'REJECTED');
}

describe('verifier_order', () => {
  it('verifier_order: reports the steps up to the earliest fault, and VERIFIED only without one', async () => {
    const draw = fc.tuple(proofBundleArb, fc.subarray([...ORDER]));
    const config = { seed: 20263008, numRuns: 200 };
    await runProperty('P8 verifier_order', config, fc.asyncProperty(draw, ([b, faults]) => checkOrder(b, faults)));
  });
});

// Policies that are not a bigint in [0, 2^40). An otherwise good bundle fails at POLICY.
const BAD_POLICIES: readonly unknown[] = [5, -1n, 2n ** 40n, '5', null, undefined, {}];

async function goodBundle(): Promise<ProofBundle> {
  const [sample] = fc.sample(proofBundleArb, { seed: 3, numRuns: 1 });
  return signedBundle(key, sample as ProofBundle);
}

describe('verifier_order policy validity', () => {
  it('verifier_order: an invalid policy fails at POLICY, after FORMAT, SIGNATURE and DIGEST_MATCH', async () => {
    const text = bundleToJson(await goodBundle());
    const verify = createVerifier(testDeps(key, recordingVerifier().verifyProof));
    for (const limitCents of BAD_POLICIES) {
      const report = await verify(text, { limitCents } as never);
      const trail = report.steps.map((s) => `${s.name}:${s.ok}`);
      expect(trail).toStrictEqual(['FORMAT:true', 'SIGNATURE:true', 'DIGEST_MATCH:true', 'POLICY:false']);
    }
  });
});

describe('verifier_order bundle fault wins', () => {
  it('verifier_order: a bad bundle with a bad policy reports the bundle fault first', async () => {
    const unsigned = { ...(await goodBundle()), signature: '0'.repeat(128) };
    const verify = createVerifier(testDeps(key, recordingVerifier().verifyProof));
    const report = await verify(bundleToJson(unsigned), { limitCents: 5 } as never);
    expect(report.steps.map((s) => s.name)).toStrictEqual(['FORMAT', 'SIGNATURE']);
  });
});
