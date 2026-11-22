// The verifier (zk-core design section B). It checks a proof bundle in a fixed order and stops at
// the first step that fails: FORMAT, SIGNATURE, DIGEST_MATCH, POLICY, CIRCUIT, PROOF.
//
// What each step trusts:
//   SIGNATURE     the key of TRUSTED_SOURCE_KEYS found by own property, never a key from the bundle.
//   DIGEST_MATCH  only compares the bundle's public_inputs with the signed root and count.
//   POLICY        only compares the bundle's limit and public_inputs[2] with the verifier's policy.
//   CIRCUIT       the generated CIRCUIT_VERSION and VK_HASH, as exact strings.
//   PROOF         inputs built here from the signed root, the signed count and the policy. The
//                 bundle's public_inputs are never passed to the proof check.
// The verifier fails closed: every step runs inside a guard, the whole run is guarded too, and a
// throw anywhere is a failed step. A detail is a fixed text and never holds data from the input.
import { verifyDigest } from '../ledger/digest';
import { AMOUNT_BOUND_CENTS } from '../ledger/field';
import type { Cents } from '../ledger/posting';
import { TRUSTED_SOURCE_KEYS } from '../ledger/trusted-keys';
import { decodeBundle, rootToDigestHex } from './bundle';
import type { ProofBundle } from './bundle';
import { CIRCUIT_VERSION, VK_HASH } from './circuit-identity';
import { createProofVerifier } from './verify-client';
import { openBrowserPort } from './worker-port';

export type VerifyStepName = 'FORMAT' | 'SIGNATURE' | 'DIGEST_MATCH' | 'POLICY' | 'CIRCUIT' | 'PROOF';

export interface VerifyStep {
  readonly name: VerifyStepName;
  readonly ok: boolean;
  readonly detail: string;
}

export interface VerifyReport {
  readonly verdict: 'VERIFIED' | 'REJECTED';
  // Every step that ran, up to and including the first one that failed.
  readonly steps: readonly VerifyStep[];
}

export interface VerifyPolicy {
  readonly limitCents: Cents;
}

// Checks a proof against the shipped key. Resolves true only for a valid proof.
export type ProofVerifier = (proof: Uint8Array, publicInputs: readonly [string, string, string]) => Promise<boolean>;

export interface VerifierDeps {
  readonly trustedKeys: Readonly<Record<string, string>>;
  readonly circuitVersion: string;
  readonly vkHash: string;
  readonly verifyProof: ProofVerifier;
}

// The only texts a report can hold. A thrown error, a codec code or an input value is never copied.
export const VERIFY_DETAILS: Readonly<Record<VerifyStepName, { readonly ok: string; readonly fail: string }>> = {
  FORMAT: { ok: 'BUNDLE FORMAT VALID', fail: 'BUNDLE FORMAT INVALID' },
  SIGNATURE: { ok: 'SIGNATURE VALID', fail: 'SIGNATURE INVALID' },
  DIGEST_MATCH: { ok: 'PUBLIC INPUTS MATCH SIGNED DIGEST', fail: 'PUBLIC INPUTS DO NOT MATCH SIGNED DIGEST' },
  POLICY: { ok: 'LIMIT MATCHES POLICY', fail: 'LIMIT DOES NOT MATCH POLICY' },
  CIRCUIT: { ok: 'CIRCUIT VERSION AND KEY HASH MATCH', fail: 'CIRCUIT VERSION OR KEY HASH DOES NOT MATCH' },
  PROOF: { ok: 'PROOF VALID', fail: 'PROOF INVALID' },
};

// SIGNATURE: the key is looked up by own property in the trusted table. An id such as
// `__proto__`, `constructor` or `toString` is not an own property, so it finds no key.
async function signatureStep(deps: VerifierDeps, bundle: ProofBundle): Promise<boolean> {
  if (!Object.hasOwn(deps.trustedKeys, bundle.sourceKeyId)) return false;
  const publicKey = deps.trustedKeys[bundle.sourceKeyId];
  if (typeof publicKey !== 'string') return false;
  const { batchId, recordCount, signature, sourceKeyId } = bundle;
  const merkleRoot = rootToDigestHex(bundle.merkleRoot);
  return verifyDigest({ batchId, merkleRoot, recordCount, signature, sourceKeyId }, publicKey);
}

// DIGEST_MATCH: the proof's own root and count must equal the signed ones. A comparison only.
function digestMatchStep(bundle: ProofBundle): boolean {
  const [root, count] = bundle.publicInputs;
  return root === bundle.merkleRoot.toString(10) && count === String(bundle.recordCount);
}

// POLICY: the policy is the verifier's own. It must be a bigint in [0, 2^40), and both the bundle's
// limit and its third public input must equal it.
function policyStep(bundle: ProofBundle, policy: VerifyPolicy): boolean {
  const limit = policy.limitCents;
  if (typeof limit !== 'bigint' || limit < 0n || limit >= AMOUNT_BOUND_CENTS) return false;
  return bundle.limitCents === limit && bundle.publicInputs[2] === limit.toString(10);
}

// CIRCUIT: the version and the key hash are compared as exact strings with the shipped ones.
function circuitStep(deps: VerifierDeps, bundle: ProofBundle): boolean {
  return bundle.circuitVersion === deps.circuitVersion && bundle.vkHash === deps.vkHash;
}

/**
 * PROOF: the inputs are built here from the signed root, the signed count and the verifier's own
 * policy. The `publicInputs` of the bundle are not read. Only the proof bytes come from the bundle.
 */
export async function proofStep(deps: VerifierDeps, bundle: ProofBundle, policy: VerifyPolicy): Promise<boolean> {
  const inputs = [bundle.merkleRoot.toString(10), String(bundle.recordCount), policy.limitCents.toString(10)] as const;
  return (await deps.verifyProof(bundle.proof, inputs)) === true;
}

// Runs one step. Only an answer of exactly `true` passes. A throw or a rejection is a failure.
async function runStep(check: () => boolean | Promise<boolean>): Promise<boolean> {
  try {
    return (await check()) === true;
  } catch {
    return false;
  }
}

type Check = (bundle: ProofBundle) => boolean | Promise<boolean>;

function rejected(steps: readonly VerifyStep[]): VerifyReport {
  // A report always names a failed step, even if something broke before any step was recorded.
  const named = steps.length > 0 ? steps : [{ name: 'FORMAT' as const, ok: false, detail: VERIFY_DETAILS.FORMAT.fail }];
  return { verdict: 'REJECTED', steps: named };
}

/**
 * Builds a verifier from its dependencies. Production code uses `verifyBundle` below. Tests pass an
 * ephemeral trusted key, other circuit constants and a recording proof check.
 */
export function createVerifier(deps: VerifierDeps): (input: unknown, policy: VerifyPolicy) => Promise<VerifyReport> {
  return async (input, policy) => {
    const steps: VerifyStep[] = [];
    const record = (name: VerifyStepName, ok: boolean): boolean => {
      steps.push({ name, ok, detail: VERIFY_DETAILS[name][ok ? 'ok' : 'fail'] });
      return ok;
    };
    try {
      const decoded: { bundle?: ProofBundle } = {};
      const formatOk = await runStep(() => {
        decoded.bundle = decodeBundle(input as string);
        return true;
      });
      const bundle = decoded.bundle;
      if (!record('FORMAT', formatOk) || bundle === undefined) return rejected(steps);
      const checks: readonly (readonly [VerifyStepName, Check])[] = [
        ['SIGNATURE', (b) => signatureStep(deps, b)],
        ['DIGEST_MATCH', digestMatchStep],
        ['POLICY', (b) => policyStep(b, policy)],
        ['CIRCUIT', (b) => circuitStep(deps, b)],
        ['PROOF', (b) => proofStep(deps, b, policy)],
      ];
      for (const [name, check] of checks) {
        if (!record(name, await runStep(() => check(bundle)))) return rejected(steps);
      }
      return { verdict: 'VERIFIED', steps };
    } catch {
      return rejected(steps);
    }
  };
}

// The proof check of the page: its own Verify_Worker, opened on first use and never at import time.
let browserProofVerifier: ProofVerifier | undefined;

const browserVerifyProof: ProofVerifier = (proof, publicInputs) => {
  browserProofVerifier ??= createProofVerifier(openBrowserPort);
  return browserProofVerifier(proof, publicInputs);
};

/** Verifies a bundle against the shipped key, the trusted source keys and the given policy. Never throws. */
export const verifyBundle = createVerifier({
  trustedKeys: TRUSTED_SOURCE_KEYS,
  circuitVersion: CIRCUIT_VERSION,
  vkHash: VK_HASH,
  verifyProof: browserVerifyProof,
});
