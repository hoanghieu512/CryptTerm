import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { NOT_COMPLETED_DETAIL, VERIFY_DETAILS, createVerifier, proofStep } from '../../src/zk/verifier';
import type { ProofVerifier } from '../../src/zk/verifier';
import { bundleToJson } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { makeEphemeralKeys } from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';
import { runProperty } from '../support/pbt';
import { POLICY_LIMIT, signedBundle, testDeps } from '../support/signed-bundle';

// Feature: verify-error, Property 2: PROOF step detail comes only from the fixed set, keyed by
// outcome (proof_step_not_completed). Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5.
// The expected texts are written out here as literals, so a change to the source text fails this test.
const VALID_TEXT = 'PROOF VALID';
const INVALID_TEXT = 'PROOF INVALID';
const NOT_COMPLETED_TEXT = 'PROOF CHECK NOT COMPLETED';

type Kind = 'valid' | 'invalid' | 'throws' | 'rejects' | 'other';
const KINDS: readonly Kind[] = ['valid', 'invalid', 'throws', 'rejects', 'other'];

const EXPECTED_OUTCOME: Readonly<Record<Kind, string>> = {
  valid: 'valid',
  invalid: 'invalid',
  throws: 'not_completed',
  rejects: 'not_completed',
  other: 'not_completed',
};
const EXPECTED_DETAIL: Readonly<Record<string, string>> = {
  valid: VALID_TEXT,
  invalid: INVALID_TEXT,
  not_completed: NOT_COMPLETED_TEXT,
};

// Values the proof check might resolve that are neither 'valid' nor 'invalid'. The sentinel is one of them.
const otherValueArb = (sentinel: string): fc.Arbitrary<unknown> =>
  fc.constantFrom<unknown>(true, false, null, undefined, 0, 1, 'VALID', 'yes', '', {}, ['valid'], sentinel);

// A stand-in for the proof check. Throws and rejections carry the sentinel.
function standIn(kind: Kind, sentinel: string, other: unknown): ProofVerifier {
  switch (kind) {
    case 'valid':
      return async () => 'valid';
    case 'invalid':
      return async () => 'invalid';
    case 'throws':
      return () => {
        throw new Error(sentinel);
      };
    case 'rejects':
      return () => Promise.reject(new Error(sentinel));
    case 'other':
      return (async () => other) as unknown as ProofVerifier;
  }
}

let key: EphemeralKey;

beforeAll(async () => {
  const keys = await makeEphemeralKeys(1);
  key = keys[0] as EphemeralKey;
});

interface Case {
  readonly bundle: ProofBundle;
  readonly kind: Kind;
  readonly sentinel: string;
  readonly other: unknown;
}

async function checkCase({ bundle, kind, sentinel, other }: Case): Promise<void> {
  const verifyProof = standIn(kind, sentinel, other);
  const outcome = EXPECTED_OUTCOME[kind] as string;
  const detail = EXPECTED_DETAIL[outcome] as string;
  const ok = outcome === 'valid';

  const signed = await signedBundle(key, bundle);
  const deps = testDeps(key, verifyProof);
  expect(await proofStep(deps, signed, { limitCents: POLICY_LIMIT })).toBe(outcome);

  const report = await createVerifier(deps)(bundleToJson(signed), { limitCents: POLICY_LIMIT });
  expect(report.steps.map((s) => s.name)).toStrictEqual(['FORMAT', 'SIGNATURE', 'DIGEST_MATCH', 'POLICY', 'CIRCUIT', 'PROOF']);
  const step = report.steps.at(-1);
  expect(step).toStrictEqual({ name: 'PROOF', ok, detail });
  expect(report.verdict).toBe(ok ? 'VERIFIED' : 'REJECTED');
  expect(JSON.stringify(report)).not.toContain(sentinel);
}

const caseArb: fc.Arbitrary<Case> = fc
  .tuple(proofBundleArb, fc.constantFrom(...KINDS), fc.string({ minLength: 1, maxLength: 40 }))
  .map(([bundle, kind, noise]) => ({ bundle, kind, sentinel: `SENTINEL:${noise}` }))
  .chain((base) => otherValueArb(base.sentinel).map((other) => ({ ...base, other })));

describe('proof_step_not_completed', () => {
  it('proof_step_not_completed: the PROOF step and its detail follow the outcome, and no sentinel leaks', async () => {
    await runProperty('verify-error P2 proof_step_not_completed', { seed: 20265102, numRuns: 100 }, fc.asyncProperty(caseArb, checkCase));
  });

  it('proof_step_not_completed: NOT_COMPLETED_DETAIL is the fixed text and the notCompleted text of PROOF', () => {
    expect(NOT_COMPLETED_DETAIL).toBe('PROOF CHECK NOT COMPLETED');
    expect(VERIFY_DETAILS.PROOF.notCompleted).toBe('PROOF CHECK NOT COMPLETED');
    expect(VERIFY_DETAILS.PROOF.notCompleted).toBe(NOT_COMPLETED_DETAIL);
  });
});
