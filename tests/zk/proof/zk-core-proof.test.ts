import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Batch } from '../../../src/ledger/batch';
import { checkBatch } from '../../../src/ledger/check-batch';
import type { SignedDigest } from '../../../src/ledger/digest';
import { isSignedDigestShape } from '../../../src/ledger/digest-shape';
import { parseBatch } from '../../../src/ledger/parse';
import { TRUSTED_SOURCE_KEYS } from '../../../src/ledger/trusted-keys';
import { bundleToJson } from '../../../src/zk/bundle';
import type { ProofBundle } from '../../../src/zk/bundle';
import { CIRCUIT_VERSION, VK_BYTE_LENGTH, VK_HASH } from '../../../src/zk/circuit-identity';
import { acirBytes, executeCircuit, proveCircuit } from '../../../src/zk/prover';
import { createProveService } from '../../../src/zk/prove-service';
import { sha256Hex } from '../../../src/zk/sha256';
import { createVerifier } from '../../../src/zk/verifier';
import type { VerifyReport } from '../../../src/zk/verifier';
import { createProofVerifier } from '../../../src/zk/verify-client';
import { buildCircuitInputs } from '../../../src/zk/witness-builder';
import { createInProcessPort } from '../../support/in-process-port';
import { createNodeBackend, createNoirEnv, createProverEnv } from '../../support/zk-env';
import type { NodeBackend } from '../../support/zk-env';

// Feature: zk-core, full-proof examples (Requirements 3.1, 3.4, 7.4, 9.2, 9.3, 9.5, 9.6).
// Runs only under `npm run test:proof`. The page-side Prove_Service, the worker core and the
// Verifier run for real over an in-process port with the real circuit and the real prover.
// Synthetic samples only. Nothing is printed, and the 30 s limit comes from vitest.proof.config.ts.

const LIMIT_CENTS = 1_000_000n;
const POLICY = { limitCents: LIMIT_CENTS } as const;
const STEP_ORDER = ['FORMAT', 'SIGNATURE', 'DIGEST_MATCH', 'POLICY', 'CIRCUIT', 'PROOF'];
const BUNDLE_ALLOW_LIST = [
  'batch_id', 'record_count', 'merkle_root', 'limit_cents', 'signature', 'source_key_id',
  'proof', 'circuit_version', 'verification_key_hash', 'public_inputs',
];

function samplePath(ext: string): string {
  return fileURLToPath(new URL(`../../../public/samples/clean.${ext}`, import.meta.url));
}

function loadClean(): { batch: Batch; digest: SignedDigest } {
  const batch = parseBatch(readFileSync(samplePath('dat'), 'utf8'));
  const digest: unknown = JSON.parse(readFileSync(samplePath('digest.json'), 'utf8'));
  if (!isSignedDigestShape(digest)) throw new Error('SAMPLE DIGEST SHAPE');
  return { batch, digest };
}

// A balanced copy of `batch` with 1 cent moved between two postings of the same side, chosen so
// that the pre-check still passes. The sums stay equal, so the proof exists but the root changes.
function withOneCentMoved(batch: Batch): Batch {
  const { postings } = batch;
  for (let from = 0; from < postings.length; from += 1) {
    for (let to = 0; to < postings.length; to += 1) {
      const a = postings[from];
      const b = postings[to];
      if (a === undefined || b === undefined || from === to || a.side !== b.side || a.amountCents < 1n) continue;
      const moved = postings.map((p, i) => {
        if (i === from) return { ...p, amountCents: p.amountCents - 1n };
        if (i === to) return { ...p, amountCents: p.amountCents + 1n };
        return p;
      });
      const candidate = { ...batch, postings: moved };
      if (checkBatch(candidate, LIMIT_CENTS).ok) return candidate;
    }
  }
  throw new Error('NO MOVABLE PAIR');
}

let backend: NodeBackend;
let verify: (input: unknown, policy: typeof POLICY) => Promise<VerifyReport>;
let prove: ReturnType<typeof createProveService>['proveBatch'];
let clean: { batch: Batch; digest: SignedDigest };
let cleanBundle: ProofBundle;

beforeAll(async () => {
  backend = await createNodeBackend();
  const openPort = () => createInProcessPort(backend);
  prove = createProveService(openPort).proveBatch;
  verify = createVerifier({
    trustedKeys: TRUSTED_SOURCE_KEYS,
    circuitVersion: CIRCUIT_VERSION,
    vkHash: VK_HASH,
    verifyProof: createProofVerifier(openPort),
  });
  clean = loadClean();
  cleanBundle = await prove(clean.batch, clean.digest, LIMIT_CENTS);
});

afterAll(async () => {
  await backend.destroy();
});

function failedStep(report: VerifyReport): string | undefined {
  return report.steps.find((s) => !s.ok)?.name;
}

describe('zk-core full proofs', () => {
  it('clean_sample_verified: the clean sample proves and verifies with six passing steps', async () => {
    const report = await verify(bundleToJson(cleanBundle), POLICY);
    expect(report.verdict).toBe('VERIFIED');
    expect(report.steps.map((s) => s.name)).toStrictEqual(STEP_ORDER);
    expect(report.steps.every((s) => s.ok)).toBe(true);
  });

  it('move_one_cent_rejected_at_digest_match: a balanced 1-cent move is rejected at DIGEST_MATCH', async () => {
    const moved = withOneCentMoved(clean.batch);
    const bundle = await prove(moved, clean.digest, LIMIT_CENTS);
    const report = await verify(bundleToJson(bundle), POLICY);
    expect(report.verdict).toBe('REJECTED');
    expect(failedStep(report)).toBe('DIGEST_MATCH');
    expect(report.steps.map((s) => [s.name, s.ok])).toStrictEqual([
      ['FORMAT', true], ['SIGNATURE', true], ['DIGEST_MATCH', false],
    ]);
  });

  it('limit_2m_rejected_at_policy: a bundle proved at limit 2,000,000 is rejected at POLICY', async () => {
    const bundle = await prove(clean.batch, clean.digest, 2_000_000n);
    expect(bundle.limitCents).toBe(2_000_000n);
    const report = await verify(bundleToJson(bundle), POLICY);
    expect(report.verdict).toBe('REJECTED');
    expect(failedStep(report)).toBe('POLICY');
    expect(report.steps.slice(0, 3).every((s) => s.ok)).toBe(true);
  });

  it('flipped_proof_byte_rejected_at_proof: one changed proof byte is rejected at PROOF', async () => {
    const proof = new Uint8Array(cleanBundle.proof);
    const at = 32 * 100 + 31;
    proof[at] = (proof[at] ?? 0) ^ 0x01;
    const report = await verify(bundleToJson({ ...cleanBundle, proof }), POLICY);
    expect(report.verdict).toBe('REJECTED');
    expect(failedStep(report)).toBe('PROOF');
    expect(report.steps.slice(0, 5).every((s) => s.ok)).toBe(true);
    expect(report.steps).toHaveLength(6);
  });

  it('bundle_allow_list: the real bundle holds exactly the ten public keys', () => {
    const keys = Object.keys(JSON.parse(bundleToJson(cleanBundle)) as Record<string, unknown>);
    expect(keys).toStrictEqual(BUNDLE_ALLOW_LIST);
  });
});

describe('shipped verification key', () => {
  let env: Awaited<ReturnType<typeof createProverEnv>>;

  beforeAll(async () => {
    env = await createProverEnv();
  });

  afterAll(async () => {
    await env.destroy();
  });

  it('shipped_vk_matches_prover_vk: the key proveCircuit returns equals the shipped file', async () => {
    const { noir, artifact } = createNoirEnv();
    const built = await buildCircuitInputs(env.hasher, { postings: clean.batch.postings, limitCents: LIMIT_CENTS });
    const executed = await executeCircuit(noir, built.inputs);
    const result = await proveCircuit(env.api, await acirBytes(artifact), executed.witness);
    const shipped = new Uint8Array(
      readFileSync(fileURLToPath(new URL('../../../src/zk/artifacts/ledger_audit.vk', import.meta.url))),
    );
    expect(Buffer.compare(shipped, result.vk)).toBe(0);
    expect(await sha256Hex(result.vk)).toBe(VK_HASH);
    expect(result.vk.length).toBe(VK_BYTE_LENGTH);
  });
});
