import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIELD_MODULUS } from '../../src/ledger/field';
import { bundleToJson } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { createVerifier, proofStep } from '../../src/zk/verifier';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { makeEphemeralKeys } from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';
import { runProperty } from '../support/pbt';
import { POLICY_LIMIT, recordingVerifier, signedBundle, testDeps } from '../support/signed-bundle';

// Feature: zk-core, Properties 10, 11 and 12: the verifier compares public_inputs and never uses
// them as the source of proof inputs. Validates: Requirements 9.2, 9.3, 9.5.
let key: EphemeralKey;

beforeAll(async () => {
  const keys = await makeEphemeralKeys(1);
  key = keys[0] as EphemeralKey;
});

// The report of the verifier for `bundle` against the default policy of 1,000,000.
async function reportFor(bundle: ProofBundle, policy = POLICY_LIMIT) {
  const verify = createVerifier(testDeps(key, recordingVerifier().verifyProof));
  return verify(bundleToJson(bundle), { limitCents: policy });
}

const shifted = (decimal: string): string => ((BigInt(decimal) + 1n) % FIELD_MODULUS).toString(10);

// Property 10: DIGEST_MATCH passes exactly when inputs 0 and 1 equal the signed root and count.
async function checkDigestMatch(base: ProofBundle, rootOk: boolean, countOk: boolean, third: string): Promise<void> {
  const signed = await signedBundle(key, base);
  const [root, count] = signed.publicInputs;
  const inputs = [rootOk ? root : shifted(root), countOk ? count : String((signed.recordCount % 64) + 1), third] as const;
  const report = await reportFor({ ...signed, publicInputs: inputs });
  const step = report.steps.find((s) => s.name === 'DIGEST_MATCH');
  expect(step?.ok).toBe(rootOk && countOk);
}


describe('digest_match_compares_public_inputs', () => {
  it('digest_match_compares_public_inputs: only inputs 0 and 1 matter, against the signed values', async () => {
    const draw = fc.tuple(proofBundleArb, fc.boolean(), fc.boolean(), fc.bigInt({ min: 0n, max: 2n ** 40n }));
    const check = ([b, rootOk, countOk, third]: [ProofBundle, boolean, boolean, bigint]) =>
      checkDigestMatch(b, rootOk, countOk, third.toString(10));
    const config = { seed: 20263010, numRuns: 100 };
    await runProperty('P10 digest_match', config, fc.asyncProperty(draw, check));
  });

  it('digest_match_compares_public_inputs: a hand-built bundle with a changed third input still matches', async () => {
    const [base] = fc.sample(proofBundleArb, { seed: 1, numRuns: 1 });
    await checkDigestMatch(base as ProofBundle, true, true, '1');
    await checkDigestMatch(base as ProofBundle, false, true, '1');
  });
});

// Property 11: POLICY passes exactly when limit_cents and public_inputs[2] both equal the policy.
async function checkPolicy(base: ProofBundle, bundleLimit: bigint, thirdInput: bigint): Promise<void> {
  const signed = await signedBundle(key, base, bundleLimit);
  const inputs = [signed.publicInputs[0], signed.publicInputs[1], thirdInput.toString(10)] as const;
  const report = await reportFor({ ...signed, publicInputs: inputs });
  const step = report.steps.find((s) => s.name === 'POLICY');
  expect(step?.ok).toBe(bundleLimit === POLICY_LIMIT && thirdInput === POLICY_LIMIT);
}

// Mostly the policy value itself or the one next to it, so that both outcomes occur often.
const limitArb: fc.Arbitrary<bigint> = fc.oneof(
  fc.constantFrom(POLICY_LIMIT, POLICY_LIMIT + 1n, 2_000_000n, 0n),
  fc.bigInt({ min: 0n, max: 2n ** 40n - 1n }),
);

describe('policy_compares_public_inputs_and_bundle_limit', () => {
  it('policy_compares_public_inputs_and_bundle_limit: both values must equal the policy', async () => {
    const draw = fc.tuple(proofBundleArb, limitArb, limitArb);
    const config = { seed: 20263011, numRuns: 100 };
    const check = ([b, l, i]: [ProofBundle, bigint, bigint]) => checkPolicy(b, l, i);
    await runProperty('P11 policy compare', config, fc.asyncProperty(draw, check));
  });

  it('policy_compares_public_inputs_and_bundle_limit: a bundle proved for 2,000,000 fails against 1,000,000', async () => {
    const [base] = fc.sample(proofBundleArb, { seed: 1, numRuns: 1 });
    await checkPolicy(base as ProofBundle, 2_000_000n, 2_000_000n);
    const report = await reportFor(await signedBundle(key, base as ProofBundle, 2_000_000n));
    expect(report.steps.at(-1)).toMatchObject({ name: 'POLICY', ok: false });
  });
});

// Property 12: the proof check gets the proof bytes and inputs built from the signed root, the
// signed count and the policy. The bundle's own public_inputs (random here) are never passed on.
async function checkProofInputs(bundle: ProofBundle, policy: bigint): Promise<void> {
  const recorder = recordingVerifier(true);
  const passed = await proofStep(testDeps(key, recorder.verifyProof), bundle, { limitCents: policy });
  expect(passed).toBe(true);
  expect(recorder.calls).toHaveLength(1);
  expect(recorder.calls[0]?.proof).toStrictEqual(bundle.proof);
  const built = [bundle.merkleRoot.toString(10), String(bundle.recordCount), policy.toString(10)];
  expect(recorder.calls[0]?.inputs).toStrictEqual(built);
}

describe('proof_step_uses_built_inputs', () => {
  it('proof_step_uses_built_inputs: public_inputs of the bundle are never the source', async () => {
    const draw = fc.tuple(proofBundleArb, fc.bigInt({ min: 0n, max: 2n ** 40n - 1n }));
    const check = ([b, p]: [ProofBundle, bigint]) => checkProofInputs(b, p);
    await runProperty('P12 proof_step', { seed: 20263012, numRuns: 100 }, fc.asyncProperty(draw, check));
  });
});
