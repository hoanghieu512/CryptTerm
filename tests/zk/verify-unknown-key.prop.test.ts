import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundleToJson } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { createVerifier } from '../../src/zk/verifier';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { makeEphemeralKeys } from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';
import { runProperty } from '../support/pbt';
import { POLICY_LIMIT, TEST_KEY_ID, recordingVerifier, signedBundle, testDeps } from '../support/signed-bundle';

// Feature: zk-core, Property 9: signature lookup trusts only own properties (verify_unknown_key).
// Validates: Requirement 9.1. A key id that is not an own property of the trusted table fails at
// SIGNATURE, whatever the signature is.
const OBJECT_NAMES = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];
const ID_CHARS = [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-'];

let keys: EphemeralKey[];

beforeAll(async () => {
  keys = await makeEphemeralKeys(2);
});

const unknownIdArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...OBJECT_NAMES),
  fc.array(fc.constantFrom(...ID_CHARS), { minLength: 1, maxLength: 64 }).map((c) => c.join('')),
).filter((id) => id !== TEST_KEY_ID);

async function trail(deps: ReturnType<typeof testDeps>, bundle: ProofBundle): Promise<string[]> {
  const report = await createVerifier(deps)(bundleToJson(bundle), { limitCents: POLICY_LIMIT });
  return report.steps.map((s) => `${s.name}:${s.ok}`);
}

async function checkUnknown(base: ProofBundle, id: string): Promise<void> {
  const [key] = keys as [EphemeralKey, EphemeralKey];
  const deps = testDeps(key, recordingVerifier().verifyProof);
  const signed = await signedBundle(key, base);
  expect(await trail(deps, { ...signed, sourceKeyId: id })).toStrictEqual(['FORMAT:true', 'SIGNATURE:false']);
}

describe('verify_unknown_key', () => {
  it('verify_unknown_key: an id outside the trusted table fails at SIGNATURE', async () => {
    const config = { seed: 20263009, numRuns: 100 };
    await runProperty('P9 verify_unknown_key', config, fc.asyncProperty(proofBundleArb, unknownIdArb, checkUnknown));
  });
});

function firstBundle(): ProofBundle {
  const [base] = fc.sample(proofBundleArb, { seed: 9, numRuns: 1 });
  return base as ProofBundle;
}

describe('verify_unknown_key examples', () => {
  it('verify_unknown_key: the named Object.prototype ids fail, the trusted id passes', async () => {
    const [key] = keys as [EphemeralKey, EphemeralKey];
    const signed = await signedBundle(key, firstBundle());
    const deps = testDeps(key, recordingVerifier().verifyProof);
    for (const id of OBJECT_NAMES) await checkUnknown(signed, id);
    expect((await trail(deps, signed))[1]).toBe('SIGNATURE:true');
  });
});

describe('verify_unknown_key wrong key', () => {
  it('verify_unknown_key: a signature from another key fails under the trusted id', async () => {
    const [trusted, other] = keys as [EphemeralKey, EphemeralKey];
    const forged = await signedBundle(other, firstBundle());
    const deps = testDeps(trusted, recordingVerifier().verifyProof);
    expect(await trail(deps, forged)).toStrictEqual(['FORMAT:true', 'SIGNATURE:false']);
  });
});
