import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundleToJson } from '../../src/zk/bundle';
import type { ProofBundle } from '../../src/zk/bundle';
import { VERIFY_DETAILS, createVerifier } from '../../src/zk/verifier';
import type { ProofVerifier, VerifyReport } from '../../src/zk/verifier';
import { proofBundleArb } from '../support/bundle-arbitraries';
import { makeEphemeralKeys } from '../support/digest-arbitraries';
import type { EphemeralKey } from '../support/digest-arbitraries';
import { runProperty } from '../support/pbt';
import { POLICY_LIMIT, signedBundle, testDeps } from '../support/signed-bundle';

// Feature: zk-core, Property 7: the verifier never throws and reports fixed text (verify_never_throws).
// Validates: Requirements 6.6, 8.3, 8.5, 9.4. Every input ends in a report with a named step.
const STEP_NAMES = ['FORMAT', 'SIGNATURE', 'DIGEST_MATCH', 'POLICY', 'CIRCUIT', 'PROOF'];
const ALL_DETAILS = new Set(
  Object.values(VERIFY_DETAILS).flatMap((d) => [d.ok, d.fail, ...(d.notCompleted === undefined ? [] : [d.notCompleted])]),
);

let key: EphemeralKey;

beforeAll(async () => {
  const keys = await makeEphemeralKeys(1);
  key = keys[0] as EphemeralKey;
});

// A report is well formed: a verdict, steps with names and fixed details, a stop at the first failure.
function expectWellFormed(report: VerifyReport): void {
  expect(['VERIFIED', 'REJECTED']).toContain(report.verdict);
  expect(report.steps.length).toBeGreaterThan(0);
  report.steps.forEach((step, i) => {
    expect(step.name).toBe(STEP_NAMES[i]);
    expect(ALL_DETAILS.has(step.detail)).toBe(true);
    expect(step.ok).toBe(i < report.steps.length - 1 || report.verdict === 'VERIFIED');
  });
  if (report.verdict === 'VERIFIED') expect(report.steps).toHaveLength(6);
}

// How the stand-in for the proof check behaves: answer, throw, reject, or return a non-boolean.
const VERIFIER_KINDS = ['true', 'false', 'throw', 'reject', 'nonBoolean'] as const;

function proofVerifierOf(kind: (typeof VERIFIER_KINDS)[number]): ProofVerifier {
  switch (kind) {
    case 'true':
      return async () => 'valid';
    case 'false':
      return async () => 'invalid';
    case 'throw':
      return () => {
        throw new Error('HOSTILE VERIFIER');
      };
    case 'reject':
      return () => Promise.reject(new Error('HOSTILE VERIFIER'));
    case 'nonBoolean':
      return (async () => 'yes') as unknown as ProofVerifier;
  }
}

// Policies: a good one, and values that break or attack the policy argument.
const POLICIES = ['good', 'null', 'undefined', 'number', 'throwingGetter', 'proxy'] as const;


const hostile = (): never => {
  throw new Error('HOSTILE POLICY');
};

function policyOf(kind: (typeof POLICIES)[number]): unknown {
  switch (kind) {
    case 'good':
      return { limitCents: POLICY_LIMIT };
    case 'number':
      return 5;
    case 'throwingGetter':
      return { get limitCents() { return hostile(); } };
    case 'proxy':
      return new Proxy({}, { get: hostile, has: hostile, ownKeys: hostile });
    case 'null':
      return null;
    case 'undefined':
      return undefined;
  }
}

const INPUT_KINDS = [
  'string', 'empty', 'truncated', 'wrongVersion', 'wrongVkHash', 'unknownId', 'nonText', 'valid',
] as const;
type InputKind = (typeof INPUT_KINDS)[number];

// The input text or value for one kind, built from a validly signed bundle.
function inputOf(kind: InputKind, signed: ProofBundle, noise: string, pick: number): unknown {
  const text = bundleToJson(signed);
  switch (kind) {
    case 'string':
      return noise;
    case 'empty':
      return '';
    case 'truncated':
      return text.slice(0, pick % text.length);
    case 'wrongVersion':
      return bundleToJson({ ...signed, circuitVersion: `${signed.circuitVersion}x` });
    case 'wrongVkHash':
      return bundleToJson({ ...signed, vkHash: '0'.repeat(64) });
    case 'unknownId':
      return bundleToJson({ ...signed, sourceKeyId: 'unknown-key' });
    case 'nonText':
      return [pick, noise, null][pick % 3];
    case 'valid':
      return text;
  }
}

interface Scenario {
  readonly bundle: ProofBundle;
  readonly kind: InputKind;
  readonly noise: string;
  readonly pick: number;
  readonly verifier: (typeof VERIFIER_KINDS)[number];
  readonly policy: (typeof POLICIES)[number];
}

// The step that must be the last one reported, or VERIFIED when every step passes.
function expectedLast(s: Scenario): string {
  if (['string', 'empty', 'truncated', 'nonText'].includes(s.kind)) return 'FORMAT';
  if (s.kind === 'unknownId') return 'SIGNATURE';
  if (s.policy !== 'good') return 'POLICY';
  if (s.kind === 'wrongVersion' || s.kind === 'wrongVkHash') return 'CIRCUIT';
  return s.verifier === 'true' ? 'VERIFIED' : 'PROOF';
}

async function runScenario(s: Scenario): Promise<void> {
  const signed = await signedBundle(key, s.bundle);
  const verify = createVerifier(testDeps(key, proofVerifierOf(s.verifier)));
  const report = await verify(inputOf(s.kind, signed, s.noise, s.pick), policyOf(s.policy) as never);
  expectWellFormed(report);
  const last = report.steps.at(-1);
  const want = expectedLast(s);
  expect(want === 'VERIFIED' ? report.verdict : last?.name).toBe(want);
}

const scenarioArb: fc.Arbitrary<Scenario> = fc.record({
  bundle: proofBundleArb,
  kind: fc.constantFrom(...INPUT_KINDS),
  noise: fc.string({ maxLength: 120 }),
  pick: fc.nat({ max: 5000 }),
  verifier: fc.constantFrom(...VERIFIER_KINDS),
  policy: fc.constantFrom(...POLICIES),
});

describe('verify_never_throws', () => {
  it('verify_never_throws: every scenario ends in a named step, never in a throw', async () => {
    const config = { seed: 20263007, numRuns: 300 };
    await runProperty('P7 verify_never_throws', config, fc.asyncProperty(scenarioArb, runScenario));
  });

  it('verify_never_throws: a 2 MB string is rejected at FORMAT', async () => {
    const verify = createVerifier(testDeps(key, proofVerifierOf('true')));
    const report = await verify('x'.repeat(2 * 1024 * 1024), { limitCents: POLICY_LIMIT });
    expectWellFormed(report);
    expect(report.steps.map((s) => s.name)).toStrictEqual(['FORMAT']);
  });
});
