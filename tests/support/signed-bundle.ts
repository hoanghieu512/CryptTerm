// Fixtures for the verifier tests: a bundle validly signed by an ephemeral key, the verifier
// dependencies that trust that key, and a recording stand-in for the proof check.
// The private half of the key never leaves the test process. Synthetic data only.
import type { ProofBundle } from '../../src/zk/bundle';
import type { ProofVerifier, VerifierDeps } from '../../src/zk/verifier';
import { signTriple } from './digest-arbitraries';
import type { EphemeralKey } from './digest-arbitraries';

export const TEST_KEY_ID = 'TEST-KEY';
export const TEST_VERSION = 'nargo-0.0.0+testversion';
export const TEST_VK_HASH = 'ab'.repeat(32);
export const POLICY_LIMIT = 1_000_000n;

// `base` with a real signature over its batch id, root and count, and fields that pass every step.
export async function signedBundle(key: EphemeralKey, base: ProofBundle, limit = POLICY_LIMIT): Promise<ProofBundle> {
  const triple = { batchId: base.batchId, merkleRoot: base.merkleRoot, recordCount: base.recordCount };
  const signed = await signTriple(key, triple, TEST_KEY_ID);
  const inputs = [base.merkleRoot.toString(10), String(base.recordCount), limit.toString(10)] as const;
  return {
    ...base,
    signature: signed.signature,
    sourceKeyId: TEST_KEY_ID,
    limitCents: limit,
    publicInputs: inputs,
    circuitVersion: TEST_VERSION,
    vkHash: TEST_VK_HASH,
  };
}

export function testDeps(key: EphemeralKey, verifyProof: ProofVerifier): VerifierDeps {
  const trustedKeys = Object.freeze({ [TEST_KEY_ID]: key.publicKeyHex });
  return { trustedKeys, circuitVersion: TEST_VERSION, vkHash: TEST_VK_HASH, verifyProof };
}

export interface ProofCall {
  readonly proof: Uint8Array;
  readonly inputs: readonly string[];
}

// A ProofVerifier that records what it was given and answers `result` ('valid' or 'invalid').
export function recordingVerifier(result: 'valid' | 'invalid' = 'valid'): { verifyProof: ProofVerifier; calls: ProofCall[] } {
  const calls: ProofCall[] = [];
  const verifyProof: ProofVerifier = async (proof, inputs) => {
    calls.push({ proof, inputs: [...inputs] });
    return result;
  };
  return { verifyProof, calls };
}
